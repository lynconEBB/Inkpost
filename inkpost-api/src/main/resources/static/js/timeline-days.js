// The timeline's data (D39), with no DOM: the ranges loaded so far, merged, and split into days.
//
// Intervals are kept as hours on the Brasília wall clock. Brasília has no daylight saving time (D27), so
// every day is 24 hours, and day k of a range starts at from + k × 24 h.
import { addDays, HOUR_MS, localOf, pad, range } from "./time.js";

/** Nothing loaded yet. */
export function emptyTimeline(version = null) {
	return {
		version,
		/** By ID, with their name and priority. */
		rules: new Map(),
		/** Each rule's covered intervals, by rule ID, sorted and merged. */
		covers: new Map(),
		/** Which rule wins, sorted and merged. */
		onAir: [],
		/** The `from` of each range loaded, so a range is never added twice. */
		loaded: new Set(),
	};
}

export function isLoaded(timeline, from) {
	return timeline.loaded.has(from);
}

/**
 * Adds the response for the range starting at `from` (a local date-time). Responses are clipped to their
 * range, so ranges never overlap, and an interval that ends exactly where one of the same rule starts
 * merges with it. A response with another version drops everything loaded before: the timeline returned
 * is then a new one, with only this range.
 */
export function addRange(timeline, from, response) {
	const result = timeline.version === response.version ? timeline : emptyTimeline(response.version);
	if (result.loaded.has(from)) {
		return result;
	}
	result.loaded.add(from);
	for (const { covers, ...rule } of response.rules) {
		result.rules.set(rule.id, rule);
		result.covers.set(rule.id, merge([...(result.covers.get(rule.id) ?? []), ...covers.map(interval)]));
	}
	result.onAir = merge([...result.onAir, ...response.onAir.map(interval)]);
	return result;
}

/**
 * The days of [from, from + count days): each with its on-air row, and one track per rule covering part of
 * it, highest first. Every segment is in hours of that day, `from` 0 to `to` 24. A track's `onAir` is where
 * that rule wins; the rest of its `covers` is where a higher rule wins.
 */
export function daysOf(timeline, from, count = 7) {
	const rules = [...timeline.rules.values()].sort((a, b) => b.priority - a.priority);
	const first = hourOf(from);
	return range(count).map((k) => {
		const start = first + 24 * k;
		const clip = (intervals) => intervals
			.filter((i) => i.end > start && i.start < start + 24)
			.map((i) => ({ from: Math.max(i.start, start) - start, to: Math.min(i.end, start + 24) - start, ruleId: i.ruleId }));
		const onAir = clip(timeline.onAir);
		const tracks = rules
			.map((rule) => ({
				rule,
				covers: clip(timeline.covers.get(rule.id) ?? []).map(segment),
				onAir: onAir.filter((s) => s.ruleId === rule.id).map(segment),
			}))
			.filter((track) => track.covers.length > 0);
		return { date: addDays(from.slice(0, 10), k), onAir, tracks };
	});
}

/** A day's segments as text, for screen readers: "06:00–09:00, 12:00–24:00". */
export function hoursText(segments) {
	return segments.map(({ from, to }) => `${pad(from)}:00–${pad(to)}:00`).join(", ");
}

function segment({ from, to }) {
	return { from, to };
}

/** An API interval, start and end with their offset, as hours; an on-air one keeps its rule. */
function interval({ start, end, ruleId }) {
	return { start: hourOf(localOf(start)), end: hourOf(localOf(end)), ruleId };
}

/** Hours since 1970 on the wall clock of a local date-time. */
function hourOf(local) {
	return Date.parse(`${local}Z`) / HOUR_MS;
}

/** Sorted, with intervals of the same rule merged where one ends exactly where the next starts. */
function merge(intervals) {
	const sorted = [...intervals].sort((a, b) => a.start - b.start);
	const result = [];
	for (const next of sorted) {
		const last = result.at(-1);
		if (last && last.end === next.start && last.ruleId === next.ruleId) {
			last.end = next.end;
		} else {
			result.push({ ...next });
		}
	}
	return result;
}
