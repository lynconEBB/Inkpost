import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addRange, daysOf, emptyTimeline, hoursText, isLoaded } from "../../main/resources/static/js/timeline-days.js";

// Far from Brasília, so a result that depends on the machine's zone fails.
process.env.TZ = "Pacific/Kiritimati";

const WEEK = "2026-10-19T00:00:00";
const NEXT_WEEK = "2026-10-26T00:00:00";

/** "21T06" is 2026-10-21T06:00:00 in Brasília, with its offset, as the API sends it. */
const at = (short) => `2026-10-${short}:00:00-03:00`;
const span = (start, end) => ({ start: at(start), end: at(end) });
const onAirOf = (rows) => rows.map(([start, end, ruleId]) => ({ ...span(start, end), ruleId }));

const trip = { id: 7, name: "Trip", priority: 2, isDefault: false, frameIds: [12, 15] };
const mornings = { id: 5, name: "Mornings", priority: 1, isDefault: false, frameIds: [3] };
const fallback = { id: 1, name: "Default", priority: 0, isDefault: true, frameIds: [1, 2, 3] };

/** The issue's example: Trip from Wednesday to Friday 00:00, over Mornings (06:00–09:00), over Default. */
function week(version = 42) {
	const days = ["19", "20", "21", "22", "23", "24", "25"];
	return {
		version,
		rules: [
			{ ...trip, covers: [span("21T00", "23T00")] },
			{ ...mornings, covers: days.map((d) => span(`${d}T06`, `${d}T09`)) },
			{ ...fallback, covers: [span("19T00", "26T00")] },
		],
		onAir: onAirOf([
			["19T00", "19T06", 1], ["19T06", "19T09", 5], ["19T09", "20T06", 1], ["20T06", "20T09", 5],
			["20T09", "21T00", 1], ["21T00", "23T00", 7], ["23T00", "23T06", 1], ["23T06", "23T09", 5],
			["23T09", "24T06", 1], ["24T06", "24T09", 5], ["24T09", "25T06", 1], ["25T06", "25T09", 5],
			["25T09", "26T00", 1],
		]),
	};
}

describe("days", () => {
	test("are 7 from the Monday, each 24 hours", () => {
		const days = daysOf(addRange(emptyTimeline(), WEEK, week()), WEEK);
		assert.deepEqual(days.map((d) => d.date),
			["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
	});

	test("split an interval across several days", () => {
		const days = daysOf(addRange(emptyTimeline(), WEEK, week()), WEEK);
		const tripOn = (day) => day.tracks.find((t) => t.rule.id === 7);
		assert.equal(tripOn(days[1]), undefined, "no track on a day the rule doesn't cover");
		assert.deepEqual(tripOn(days[2]).covers, [{ from: 0, to: 24 }]);
		assert.deepEqual(tripOn(days[3]).covers, [{ from: 0, to: 24 }]);
		assert.equal(tripOn(days[4]), undefined, "the end is exclusive");
	});

	test("clip an interval to the day", () => {
		const response = {
			version: 1,
			rules: [{ ...trip, covers: [span("20T18", "22T06")] }],
			onAir: [{ ...span("20T18", "22T06"), ruleId: 7 }],
		};
		const days = daysOf(addRange(emptyTimeline(), WEEK, response), WEEK);
		assert.deepEqual(days[1].tracks[0].covers, [{ from: 18, to: 24 }]);
		assert.deepEqual(days[2].tracks[0].covers, [{ from: 0, to: 24 }]);
		assert.deepEqual(days[3].tracks[0].covers, [{ from: 0, to: 6 }]);
		assert.deepEqual(days[3].onAir, [{ from: 0, to: 6, ruleId: 7 }]);
	});

	test("have one track per covering rule, highest first, solid where it wins", () => {
		const [monday, , wednesday] = daysOf(addRange(emptyTimeline(), WEEK, week()), WEEK);
		assert.deepEqual(monday.tracks.map((t) => t.rule.name), ["Mornings", "Default"]);
		assert.deepEqual(wednesday.tracks.map((t) => t.rule.name), ["Trip", "Mornings", "Default"]);

		const [tripTrack, morningTrack, defaultTrack] = wednesday.tracks;
		assert.deepEqual(tripTrack.onAir, [{ from: 0, to: 24 }]);
		assert.deepEqual(morningTrack.covers, [{ from: 6, to: 9 }]);
		assert.deepEqual(morningTrack.onAir, [], "hatched: covered, but the trip wins");
		assert.deepEqual(defaultTrack.onAir, []);
		assert.deepEqual(wednesday.onAir, [{ from: 0, to: 24, ruleId: 7 }]);

		assert.deepEqual(monday.onAir, [
			{ from: 0, to: 6, ruleId: 1 },
			{ from: 6, to: 9, ruleId: 5 },
			{ from: 9, to: 24, ruleId: 1 },
		]);
	});
});

describe("loaded weeks", () => {
	test("merge where an interval meets the next week's at the boundary", () => {
		const first = {
			version: 3,
			rules: [{ ...trip, covers: [span("25T12", "26T00")] }],
			onAir: [{ ...span("25T12", "26T00"), ruleId: 7 }],
		};
		const second = {
			version: 3,
			rules: [{ ...trip, covers: [span("26T00", "26T09")] }],
			onAir: [{ ...span("26T00", "26T09"), ruleId: 7 }],
		};
		const timeline = addRange(addRange(emptyTimeline(), WEEK, first), NEXT_WEEK, second);
		assert.equal(timeline.covers.get(7).length, 1, "one interval");
		assert.equal(timeline.onAir.length, 1);
		assert.ok(isLoaded(timeline, WEEK) && isLoaded(timeline, NEXT_WEEK));

		const [sunday, monday] = daysOf(timeline, "2026-10-25T00:00:00", 2);
		assert.deepEqual(sunday.tracks[0].covers, [{ from: 12, to: 24 }]);
		assert.deepEqual(monday.tracks[0].covers, [{ from: 0, to: 9 }]);
	});

	test("don't merge intervals of different rules", () => {
		const first = { version: 3, rules: [], onAir: [{ ...span("25T21", "26T00"), ruleId: 7 }] };
		const second = { version: 3, rules: [], onAir: [{ ...span("26T00", "26T03"), ruleId: 1 }] };
		const timeline = addRange(addRange(emptyTimeline(), WEEK, first), NEXT_WEEK, second);
		assert.equal(timeline.onAir.length, 2);
	});

	test("are added once", () => {
		const timeline = addRange(addRange(emptyTimeline(), WEEK, week()), WEEK, week());
		assert.equal(timeline.covers.get(5).length, 7);
		assert.equal(timeline.covers.get(1).length, 1);
	});

	test("are all dropped by a new version", () => {
		const old = addRange(emptyTimeline(), WEEK, week(42));
		const next = {
			version: 43,
			rules: [{ ...fallback, covers: [span("26T00", "31T00")] }],
			onAir: [{ ...span("26T00", "31T00"), ruleId: 1 }],
		};
		const timeline = addRange(old, NEXT_WEEK, next);
		assert.equal(timeline.version, 43);
		assert.ok(!isLoaded(timeline, WEEK), "the old week has to be loaded again");
		assert.ok(isLoaded(timeline, NEXT_WEEK));
		assert.deepEqual([...timeline.rules.keys()], [1]);
		assert.deepEqual(daysOf(timeline, WEEK)[0].tracks, []);
		assert.deepEqual(daysOf(timeline, WEEK)[0].onAir, []);
	});
});

test("segments read as hours, up to 24:00", () => {
	assert.equal(hoursText([{ from: 6, to: 9 }, { from: 12, to: 24 }]), "06:00–09:00, 12:00–24:00");
	assert.equal(hoursText([]), "");
});
