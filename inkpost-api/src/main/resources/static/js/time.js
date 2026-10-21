// Brasília time (D27, D39), with no DOM.
//
// Brasília is UTC−3 all year, with no daylight saving time, so date arithmetic runs on UTC dates that
// hold the Brasília wall clock: the browser's own zone never applies. Times are shown with Intl in
// America/Sao_Paulo, whatever the browser's zone.
//
// A "local" date-time is Brasília wall-clock text without an offset, as the API takes it (D41):
// 2026-11-20T06:00:00. A "date" is 2026-11-20.

export const ZONE = "America/Sao_Paulo";
const OFFSET = "-03:00";
const OFFSET_MS = -3 * 60 * 60 * 1000;

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** The frame wakes every 3 hours (D3), so a day has 8 blocks: 00:00, 03:00, … 21:00 (D26). */
export const BLOCK_HOURS = 3;
export const BLOCKS = 8;

const dayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "short", day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The local date-time of an instant, to the second. */
export function toLocal(instant) {
	return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 19);
}

/** The instant of a local date-time, or of a date at 00:00. */
export function toInstant(local) {
	return new Date(`${local.length === 10 ? `${local}T00:00:00` : local}${OFFSET}`);
}

/** A date-time from the API, which carries its offset (D41), as a local date-time. A local one stays as it is. */
export function localOf(dateTime) {
	return /(Z|[+-]\d\d:\d\d)$/.test(dateTime) ? toLocal(new Date(dateTime)) : dateTime.slice(0, 19);
}

/** Across midnight and month ends. */
export function addHours(local, hours) {
	return new Date(Date.parse(`${local}Z`) + hours * HOUR_MS).toISOString().slice(0, 19);
}

export function addDays(date, days) {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Today's date in Brasília. */
export function today(now = new Date()) {
	return toLocal(now).slice(0, 10);
}

/** Weeks start on Monday (ISO). */
export function mondayOf(date) {
	const daysSinceMonday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
	return addDays(date, -daysSinceMonday);
}

/** The week a date is in, as the timeline asks for it: Monday 00:00 to the next Monday 00:00 (D39). */
export function weekOf(date) {
	const monday = mondayOf(date);
	return { from: `${monday}T00:00:00`, to: `${addDays(monday, 7)}T00:00:00` };
}

/** A block's 3 hours: block 2, 06:00, is hours 6, 7 and 8 (D38). */
export function hoursOfBlock(block) {
	return [0, 1, 2].map((i) => block * BLOCK_HOURS + i);
}

export function hoursOfBlocks(blocks) {
	return blocks.flatMap(hoursOfBlock);
}

/** The blocks whose 3 hours are all in the list. */
export function blocksOfHours(hours) {
	const set = new Set(hours);
	return range(BLOCKS).filter((block) => hoursOfBlock(block).every((hour) => set.has(hour)));
}

/** When a block starts: 06:00. */
export function blockTime(block) {
	return `${pad(block * BLOCK_HOURS)}:00`;
}

/** A date and a block as a local date-time: 2026-11-20 and block 2 are 2026-11-20T06:00:00. */
export function atBlock(date, block) {
	return `${date}T${blockTime(block)}:00`;
}

/** The date and the block of a local date-time on a 3-hour mark. */
export function splitBlock(local) {
	return { date: local.slice(0, 10), block: Math.floor(Number(local.slice(11, 13)) / BLOCK_HOURS) };
}

/**
 * The rule form's "Until" is the last block shown, inclusive, while a rule's end is exclusive (D38, D45):
 * until 29 Nov, block 21:00, is an end of 30 Nov 00:00.
 */
export function untilToEnd(date, block) {
	return addHours(atBlock(date, block), BLOCK_HOURS);
}

/** The "Until" a rule's end is shown as: the block just before it. */
export function endToUntil(end) {
	return splitBlock(addHours(end, -BLOCK_HOURS));
}

/** When the frame wakes next: 1 minute past a 3-hour mark (D3, D25). */
export function nextWake(now = new Date()) {
	const local = toLocal(now);
	const hour = Number(local.slice(11, 13));
	const wake = toInstant(`${local.slice(0, 11)}${pad(hour - (hour % BLOCK_HOURS))}:01:00`);
	return wake > now ? wake : new Date(wake.getTime() + BLOCK_HOURS * HOUR_MS);
}

/** Wed 21 Oct */
export function formatDay(instant) {
	return dayFormat.format(instant);
}

/** 15:01, on the 24-hour clock */
export function formatTime(instant) {
	return timeFormat.format(instant);
}

export function pad(number) {
	return String(number).padStart(2, "0");
}

export function range(length, start = 0) {
	return Array.from({ length }, (_, i) => start + i);
}
