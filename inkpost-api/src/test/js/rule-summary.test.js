import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isEvery, summary } from "../../main/resources/static/js/rule-summary.js";
import { range } from "../../main/resources/static/js/time.js";

// Far from Brasília, so a result that depends on the machine's zone fails.
process.env.TZ = "Pacific/Kiritimati";

const NOW = new Date("2026-10-21T15:00:00-03:00");

/** A rule as the API returns it: every value listed, no window. */
function rule(fields = {}) {
	return {
		id: 7,
		name: "Trip",
		isDefault: false,
		startAt: null,
		endAt: null,
		frameIds: [1, 2, 3],
		hours: range(24),
		daysOfMonth: range(31, 1),
		months: range(12, 1),
		weekdays: range(7, 1),
		...fields,
	};
}

describe("the summary", () => {
	test("is the issue's example", () => {
		const weekend = rule({
			weekdays: [6, 7],
			hours: range(6, 6),
			startAt: "2026-11-20T00:00:00-03:00",
			endAt: "2026-11-30T00:00:00-03:00",
		});
		assert.equal(summary(weekend, NOW), "Sat, Sun · 06:00–12:00 · 20 Nov → 29 Nov · 3 frames");
	});

	test("of a rule covering every value says so", () => {
		assert.equal(summary(rule(), NOW), "Every hour · 3 frames");
		assert.equal(
			summary(rule({ hours: null, daysOfMonth: null, months: null, weekdays: null }), NOW),
			"Every hour · 3 frames",
			"null lists, as the form sends them, mean every value",
		);
	});

	test("of the default rule says it's the fallback", () => {
		assert.equal(summary(rule({ isDefault: true }), NOW), "When no other rule covers the hour · 3 frames");
		assert.equal(summary(rule({ isDefault: true, frameIds: [] }), NOW), "When no other rule covers the hour · No frames");
	});

	test("counts the frames, repeats included", () => {
		assert.equal(summary(rule({ frameIds: [4] }), NOW), "Every hour · 1 frame");
		assert.equal(summary(rule({ frameIds: [4, 4] }), NOW), "Every hour · 2 frames");
		assert.equal(summary(rule({ frameIds: [] }), NOW), "Every hour · No frames");
	});

	test("puts the fields in order: weekdays, days, months, hours, window", () => {
		const all = rule({
			weekdays: [5],
			daysOfMonth: [13],
			months: [12],
			hours: [18, 19, 20],
			startAt: "2026-12-01T00:00:00",
		});
		assert.equal(summary(all, NOW), "Fri · Day 13 · Dec · 18:00–21:00 · From 1 Dec · 3 frames");
	});
});

describe("hours", () => {
	test("merge consecutive blocks into one range", () => {
		assert.equal(summary(rule({ hours: range(6, 6) }), NOW), "06:00–12:00 · 3 frames");
		assert.equal(summary(rule({ hours: [8, 6, 7, 6] }), NOW), "06:00–09:00 · 3 frames", "in any order, repeats ignored");
	});

	test("keep separate blocks apart", () => {
		assert.equal(summary(rule({ hours: [0, 1, 2, 12, 13, 14] }), NOW), "00:00–03:00, 12:00–15:00 · 3 frames");
	});

	test("end the day at 24:00", () => {
		assert.equal(summary(rule({ hours: [0, 1, 2, 21, 22, 23] }), NOW), "00:00–03:00, 21:00–24:00 · 3 frames");
	});
});

describe("days and lists", () => {
	test("merge runs of 3 or more into ranges", () => {
		assert.equal(summary(rule({ daysOfMonth: [1, 2, 3, 4, 5, 13] }), NOW), "Days 1–5, 13 · 3 frames");
		assert.equal(summary(rule({ weekdays: [1, 2, 3, 4, 5] }), NOW), "Mon–Fri · 3 frames");
		assert.equal(summary(rule({ months: [6, 7, 8] }), NOW), "Jun–Aug · 3 frames");
	});

	test("list runs of 2 as they are", () => {
		assert.equal(summary(rule({ weekdays: [6, 7] }), NOW), "Sat, Sun · 3 frames");
		assert.equal(summary(rule({ daysOfMonth: [1, 2, 31] }), NOW), "Days 1, 2, 31 · 3 frames");
		assert.equal(summary(rule({ months: [1, 12] }), NOW), "Jan, Dec · 3 frames");
	});

	test("name a single day", () => {
		assert.equal(summary(rule({ daysOfMonth: [13] }), NOW), "Day 13 · 3 frames");
	});

	test("are every value only when all are there", () => {
		assert.equal(isEvery(null, "weekdays"), true);
		assert.equal(isEvery(range(7, 1), "weekdays"), true);
		assert.equal(isEvery(range(6, 1), "weekdays"), false);
		assert.equal(isEvery(range(31, 1), "daysOfMonth"), true);
	});
});

describe("the window", () => {
	test("can be open at either end", () => {
		assert.equal(summary(rule({ startAt: "2026-11-20T00:00:00-03:00" }), NOW), "From 20 Nov · 3 frames");
		assert.equal(summary(rule({ endAt: "2026-11-30T00:00:00-03:00" }), NOW), "Until 29 Nov · 3 frames");
	});

	test("shows the day an end at midnight includes", () => {
		assert.equal(summary(rule({ endAt: "2026-12-01T00:00:00" }), NOW), "Until 30 Nov · 3 frames");
		assert.equal(summary(rule({ endAt: "2027-01-01T00:00:00" }), NOW), "Until 31 Dec · 3 frames");
	});

	test("shows the time when it doesn't start or end at midnight", () => {
		const rush = rule({ startAt: "2026-11-20T06:00:00", endAt: "2026-11-29T12:00:00" });
		assert.equal(summary(rush, NOW), "20 Nov 06:00 → 29 Nov 12:00 · 3 frames");
	});

	test("of one whole day is that day", () => {
		const day = rule({ startAt: "2026-12-25T00:00:00", endAt: "2026-12-26T00:00:00" });
		assert.equal(summary(day, NOW), "25 Dec · 3 frames");
	});

	test("names the year when it isn't this year", () => {
		const nextYear = rule({ startAt: "2026-12-28T00:00:00", endAt: "2027-01-04T00:00:00" });
		assert.equal(summary(nextYear, NOW), "28 Dec → 3 Jan 2027 · 3 frames");
	});

	test("is in Brasília time whatever the offset it comes with", () => {
		assert.equal(summary(rule({ startAt: "2026-11-20T09:00:00Z" }), NOW), "From 20 Nov 06:00 · 3 frames");
	});
});
