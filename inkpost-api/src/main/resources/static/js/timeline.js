// Draws the timeline's days (D39): each day an on-air row in the winners' colors, then one track per rule
// covering part of it, highest first, solid where the rule is on air and hatched where a higher rule wins.
// The days come from timeline-days.js; this module only builds the DOM.
import { ruleColor } from "./colors.js";
import { hoursText } from "./timeline-days.js";
import { formatDay, toInstant } from "./time.js";
import { clone } from "./ui.js";

/**
 * `ruleOf` looks a rule up by ID, for the on-air row. Today's day gets a marker at `nowHour`, the hour of
 * the day with its minutes as a fraction.
 */
export function drawDays(list, days, { ruleOf, today, nowHour }) {
	list.replaceChildren(...days.map((day) => drawDay(day, ruleOf, day.date === today ? nowHour : null)));
}

function drawDay(day, ruleOf, nowHour) {
	const item = clone("timeline-day");
	item.dataset.date = day.date;
	item.querySelector(".day__label").textContent = formatDay(toInstant(day.date));
	if (nowHour !== null) {
		item.classList.add("day--today");
		item.setAttribute("aria-current", "date");
		item.querySelector(".day__today").hidden = false;
	}

	const air = item.querySelector(".day__row--air .bar");
	for (const part of day.onAir) {
		const rule = ruleOf(part.ruleId);
		air.append(segment(part, rule, "solid", rule?.name));
	}
	item.querySelector(".day__air-text").textContent = day.onAir.length > 0
		? day.onAir.map((part) => `${ruleOf(part.ruleId)?.name ?? "A rule"} ${hoursText([part])}`).join(", ")
		: "nothing";
	addNowLine(air, nowHour);

	item.querySelector(".day__tracks").replaceChildren(...day.tracks.map((track) => drawTrack(track, nowHour)));
	return item;
}

/** A link to the rule's form; the whole row is the tap target. */
function drawTrack({ rule, covers, onAir }, nowHour) {
	const item = clone("timeline-track");
	const link = item.querySelector(".track");
	link.href = `/rules/${rule.id}`;
	link.setAttribute("aria-label",
		`${rule.name}: covers ${hoursText(covers)}; on air ${onAir.length > 0 ? hoursText(onAir) : "never"}`);
	const name = item.querySelector(".day__name");
	name.textContent = rule.name;
	// The name is cut short on phones; the whole name is extra information only (D43).
	name.title = rule.name;
	const bar = item.querySelector(".bar");
	bar.append(...covers.map((part) => segment(part, rule, "hatched")), ...onAir.map((part) => segment(part, rule, "solid")));
	addNowLine(bar, nowHour);
	return item;
}

function segment({ from, to }, rule, kind, title) {
	const part = clone("timeline-segment");
	part.classList.add(`segment--${kind}`);
	part.style.left = `${(from / 24) * 100}%`;
	part.style.width = `${((to - from) / 24) * 100}%`;
	part.style.setProperty("--rule-color", rule ? ruleColor(rule) : "transparent");
	if (title) {
		part.title = title;
	}
	return part;
}

function addNowLine(bar, nowHour) {
	if (nowHour !== null) {
		const line = clone("timeline-now");
		line.style.left = `${(nowHour / 24) * 100}%`;
		bar.append(line);
	}
}
