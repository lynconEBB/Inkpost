// A rule in one line, the same in the rule list and the rule form: "Sat, Sun · 06:00–12:00 · 20 Nov → 29 Nov
// · 3 frames" (D38, D45). No DOM.
import { addHours, localOf, pad, range, today } from "./time.js";

/** 1 = Monday … 7 = Sunday (ISO), as the API numbers them. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** How many values each pattern field has; a list with all of them means every value (D41). */
export const VALUE_COUNTS = { hours: 24, weekdays: 7, daysOfMonth: 31, months: 12 };

/** Runs at least this long are shown as a range: "Mon–Fri", but "Sat, Sun". */
const RANGE_MIN = 3;

/**
 * The summary of a rule as the API returns it, or as the form sends it: a null pattern list means every
 * value, and startAt and endAt are null, local or with the offset. Dates name their year only when it
 * isn't this year.
 */
export function summary(rule, now = new Date()) {
	const frames = framesText(rule.frameIds.length);
	if (rule.isDefault) {
		return `When no other rule covers the hour · ${frames}`;
	}
	const thisYear = today(now).slice(0, 4);
	const parts = [
		values(rule.weekdays, "weekdays", (day) => WEEKDAYS[day - 1]),
		days(rule.daysOfMonth),
		values(rule.months, "months", (month) => MONTHS[month - 1]),
		hours(rule.hours),
		window(rule.startAt && localOf(rule.startAt), rule.endAt && localOf(rule.endAt), thisYear),
	].filter(Boolean);
	return [...(parts.length > 0 ? parts : ["Every hour"]), frames].join(" · ");
}

export function isEvery(list, field) {
	return list == null || new Set(list).size >= VALUE_COUNTS[field];
}

function framesText(count) {
	if (count === 0) {
		return "No frames";
	}
	return count === 1 ? "1 frame" : `${count} frames`;
}

/** "Mon–Fri", "Sat, Sun", "Jan, Jun–Aug"; nothing for every value. */
function values(list, field, label) {
	if (isEvery(list, field)) {
		return null;
	}
	return runs(list)
		.flatMap(([first, last]) => (last - first + 1 >= RANGE_MIN
			? [`${label(first)}–${label(last)}`]
			: range(last - first + 1, first).map(label)))
		.join(", ");
}

/** "Day 13", "Days 1–5, 13". */
function days(list) {
	const text = values(list, "daysOfMonth", String);
	if (text === null) {
		return null;
	}
	return new Set(list).size === 1 ? `Day ${text}` : `Days ${text}`;
}

/** Hours merged into ranges, each up to the end of its last hour: "06:00–12:00", "21:00–24:00". */
function hours(list) {
	if (isEvery(list, "hours")) {
		return null;
	}
	return runs(list).map(([first, last]) => `${pad(first)}:00–${pad(last + 1)}:00`).join(", ");
}

/**
 * "20 Nov → 29 Nov", "From 20 Nov 06:00", "Until 29 Nov". An end at midnight shows the day before, which
 * it includes whole (D45); any other end shows when it ends.
 */
function window(start, end, thisYear) {
	if (!start && !end) {
		return null;
	}
	const startText = start && dateTime(start, thisYear);
	const endText = end && (end.endsWith("T00:00:00")
		? dateTime(addHours(end, -24), thisYear, { dateOnly: true })
		: dateTime(end, thisYear));
	if (!end) {
		return `From ${startText}`;
	}
	if (!start) {
		return `Until ${endText}`;
	}
	// A rule of whole days within one day: "20 Nov".
	return startText === endText ? startText : `${startText} → ${endText}`;
}

/** "20 Nov", "20 Nov 06:00", "20 Nov 2027". */
function dateTime(local, thisYear, { dateOnly = false } = {}) {
	const year = local.slice(0, 4);
	const date = `${Number(local.slice(8, 10))} ${MONTHS[Number(local.slice(5, 7)) - 1]}${year === thisYear ? "" : ` ${year}`}`;
	const time = local.slice(11, 16);
	return dateOnly || time === "00:00" ? date : `${date} ${time}`;
}

/** Sorted, distinct values as [first, last] runs of consecutive values. */
function runs(list) {
	const sorted = [...new Set(list)].sort((a, b) => a - b);
	const result = [];
	for (const value of sorted) {
		const last = result.at(-1);
		if (last && value === last[1] + 1) {
			last[1] = value;
		} else {
			result.push([value, value]);
		}
	}
	return result;
}
