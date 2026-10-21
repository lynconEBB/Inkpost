import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	addDays,
	addHours,
	atBlock,
	blocksOfHours,
	blockTime,
	endToUntil,
	formatDay,
	formatTime,
	hoursOfBlock,
	hoursOfBlocks,
	localOf,
	mondayOf,
	nextWake,
	range,
	splitBlock,
	toInstant,
	toLocal,
	today,
	untilToEnd,
	weekOf,
} from "../../main/resources/static/js/time.js";

// Far from Brasília, so a result that depends on the machine's zone fails.
process.env.TZ = "Pacific/Kiritimati";

const brasilia = (local) => new Date(`${local}-03:00`);

describe("local date-times", () => {
	test("are the Brasília wall clock of an instant", () => {
		assert.equal(toLocal(new Date("2026-10-21T18:01:00Z")), "2026-10-21T15:01:00");
		assert.equal(toLocal(new Date("2026-10-22T02:30:00Z")), "2026-10-21T23:30:00");
		assert.equal(toInstant("2026-10-21T15:00:00").toISOString(), "2026-10-21T18:00:00.000Z");
		assert.equal(toInstant("2026-10-21").toISOString(), "2026-10-21T03:00:00.000Z");
	});

	test("come from the API's date-times, whatever their offset", () => {
		assert.equal(localOf("2026-11-20T06:00:00-03:00"), "2026-11-20T06:00:00");
		assert.equal(localOf("2026-11-20T09:00:00Z"), "2026-11-20T06:00:00");
		assert.equal(localOf("2026-11-20T00:00:00+00:00"), "2026-11-19T21:00:00");
		assert.equal(localOf("2026-11-20T06:00:00"), "2026-11-20T06:00:00", "a local one stays as it is");
	});

	test("today is the date in Brasília", () => {
		assert.equal(today(new Date("2026-10-22T02:30:00Z")), "2026-10-21");
		assert.equal(today(new Date("2026-10-22T03:00:00Z")), "2026-10-22");
	});

	test("add hours and days across midnight, month ends and years", () => {
		assert.equal(addHours("2026-10-31T21:00:00", 3), "2026-11-01T00:00:00");
		assert.equal(addHours("2026-12-31T21:00:00", 3), "2027-01-01T00:00:00");
		assert.equal(addHours("2026-03-01T00:00:00", -3), "2026-02-28T21:00:00");
		assert.equal(addDays("2028-02-28", 1), "2028-02-29");
		assert.equal(addDays("2026-12-28", 7), "2027-01-04");
	});
});

describe("weeks", () => {
	test("start on the Monday", () => {
		assert.equal(mondayOf("2026-10-19"), "2026-10-19");
		assert.equal(mondayOf("2026-10-21"), "2026-10-19");
		assert.equal(mondayOf("2026-10-25"), "2026-10-19", "Sunday is the last day of the week");
	});

	test("cross months and years", () => {
		assert.equal(mondayOf("2026-11-01"), "2026-10-26");
		assert.equal(mondayOf("2027-01-01"), "2026-12-28");
		assert.equal(mondayOf("2028-03-01"), "2028-02-28");
	});

	test("run from Monday 00:00 to the next Monday 00:00", () => {
		assert.deepEqual(weekOf("2026-10-21"), { from: "2026-10-19T00:00:00", to: "2026-10-26T00:00:00" });
		assert.deepEqual(weekOf("2026-12-30"), { from: "2026-12-28T00:00:00", to: "2027-01-04T00:00:00" });
	});
});

describe("blocks", () => {
	test("are 3 hours each", () => {
		assert.deepEqual(hoursOfBlock(0), [0, 1, 2]);
		assert.deepEqual(hoursOfBlock(2), [6, 7, 8]);
		assert.deepEqual(hoursOfBlock(7), [21, 22, 23]);
		assert.deepEqual(hoursOfBlocks([0, 7]), [0, 1, 2, 21, 22, 23]);
	});

	test("come back from their hours", () => {
		assert.deepEqual(blocksOfHours([6, 7, 8, 9, 10, 11]), [2, 3]);
		assert.deepEqual(blocksOfHours(range(24)), range(8));
		assert.deepEqual(blocksOfHours([6, 7]), [], "a block with an hour missing is not selected");
	});

	test("start on the marks", () => {
		assert.equal(blockTime(0), "00:00");
		assert.equal(blockTime(2), "06:00");
		assert.equal(blockTime(7), "21:00");
	});

	test("join a date into a local date-time, and split back", () => {
		assert.equal(atBlock("2026-11-20", 2), "2026-11-20T06:00:00");
		assert.equal(atBlock("2026-11-20", 0), "2026-11-20T00:00:00");
		assert.deepEqual(splitBlock("2026-11-20T21:00:00"), { date: "2026-11-20", block: 7 });
		assert.deepEqual(splitBlock("2026-11-20T00:00:00"), { date: "2026-11-20", block: 0 });
	});
});

describe("until, the last block shown, and the exclusive end (D45)", () => {
	test("the end is 3 hours after the last block starts", () => {
		assert.equal(untilToEnd("2026-11-29", 2), "2026-11-29T09:00:00");
		assert.equal(untilToEnd("2026-11-29", 6), "2026-11-29T21:00:00");
	});

	test("until the last block of a day ends at the next midnight", () => {
		assert.equal(untilToEnd("2026-11-29", 7), "2026-11-30T00:00:00");
		assert.equal(untilToEnd("2026-11-30", 7), "2026-12-01T00:00:00", "across a month end");
		assert.equal(untilToEnd("2026-12-31", 7), "2027-01-01T00:00:00", "across a year end");
		assert.equal(untilToEnd("2028-02-28", 7), "2028-02-29T00:00:00", "into a leap day");
		assert.equal(untilToEnd("2027-02-28", 7), "2027-03-01T00:00:00", "past February");
	});

	test("an end shows as the block before it", () => {
		assert.deepEqual(endToUntil("2026-11-30T00:00:00"), { date: "2026-11-29", block: 7 });
		assert.deepEqual(endToUntil("2026-12-01T00:00:00"), { date: "2026-11-30", block: 7 });
		assert.deepEqual(endToUntil("2027-01-01T00:00:00"), { date: "2026-12-31", block: 7 });
		assert.deepEqual(endToUntil("2028-03-01T00:00:00"), { date: "2028-02-29", block: 7 });
		assert.deepEqual(endToUntil("2026-11-29T09:00:00"), { date: "2026-11-29", block: 2 });
		assert.deepEqual(endToUntil("2026-11-29T03:00:00"), { date: "2026-11-29", block: 0 });
	});

	test("round trip for every block", () => {
		for (const block of range(8)) {
			for (const date of ["2026-01-31", "2026-02-28", "2026-12-31", "2028-02-29"]) {
				assert.deepEqual(endToUntil(untilToEnd(date, block)), { date, block });
			}
		}
	});
});

describe("the next wake", () => {
	test("is 1 minute past the next 3-hour mark", () => {
		assert.deepEqual(nextWake(brasilia("2026-10-21T15:30:00")), brasilia("2026-10-21T18:01:00"));
		assert.deepEqual(nextWake(brasilia("2026-10-21T17:58:00")), brasilia("2026-10-21T18:01:00"));
		assert.deepEqual(nextWake(brasilia("2026-10-21T18:00:30")), brasilia("2026-10-21T18:01:00"));
	});

	test("is the next mark once this one's wake has passed", () => {
		assert.deepEqual(nextWake(brasilia("2026-10-21T15:01:00")), brasilia("2026-10-21T18:01:00"));
		assert.deepEqual(nextWake(brasilia("2026-10-21T15:02:00")), brasilia("2026-10-21T18:01:00"));
	});

	test("crosses midnight and the year", () => {
		assert.deepEqual(nextWake(brasilia("2026-10-21T23:30:00")), brasilia("2026-10-22T00:01:00"));
		assert.deepEqual(nextWake(brasilia("2026-12-31T22:00:00")), brasilia("2027-01-01T00:01:00"));
	});
});

describe("formats", () => {
	test("show Brasília time", () => {
		assert.equal(formatDay(new Date("2026-10-21T02:00:00Z")), "Tue 20 Oct");
		assert.equal(formatDay(brasilia("2026-10-21T15:00:00")), "Wed 21 Oct");
		assert.equal(formatTime(new Date("2026-10-21T18:01:00Z")), "15:01");
	});

	test("use the 24-hour clock", () => {
		assert.equal(formatTime(brasilia("2026-10-21T00:05:00")), "00:05");
		assert.equal(formatTime(brasilia("2026-10-21T21:00:00")), "21:00");
	});
});
