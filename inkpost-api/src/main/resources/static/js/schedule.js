// The schedule page: what the frame shows now, the rules (moved and deleted here, edited on the rule form),
// and the timeline of a week (D38, D39).
import { api } from "./api.js";
import { ruleColor } from "./colors.js";
import { summary } from "./rule-summary.js";
import { drawDays } from "./timeline.js";
import { addRange, daysOf, emptyTimeline, isLoaded } from "./timeline-days.js";
import { addDays, formatAgo, formatTime, formatWeek, formatWhen, nextWake, toLocal, today, weekOf } from "./time.js";
import { busy, clone, showError, showSuccess } from "./ui.js";

const ruleList = document.getElementById("rule-list");
const dayList = document.getElementById("days");

/** Highest first, so the default rule is last. */
let rules = [];
/** The frame's last request (GET /api/device). */
let device = null;
/** Every week loaded so far, kept in memory only (D39). */
let timeline = emptyTimeline();
/** The Monday 00:00 of the week shown, a local date-time. */
let week = weekOf(today()).from;

document.getElementById("previous-week").addEventListener("click", (event) => showWeek(addDays(week.slice(0, 10), -7), event.currentTarget));
document.getElementById("next-week").addEventListener("click", (event) => showWeek(addDays(week.slice(0, 10), 7), event.currentTarget));
document.getElementById("this-week").addEventListener("click", async (event) => {
	await showWeek(today(), event.currentTarget);
	scrollToToday({ page: true });
});
// The frame wakes every 3 hours (D3): coming back to the tab shows what changed meanwhile.
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") {
		loadDevice();
		loadWeek({ force: true });
	}
});
// "2 h ago" and the now marker move on.
setInterval(() => {
	renderDevice();
	renderDays();
}, 60 * 1000);
load();

async function load() {
	await Promise.all([loadRules(), loadWeek()]);
	await loadDevice();
	scrollToToday({ page: false });
}

// ---------- Rules ----------

async function loadRules() {
	try {
		rules = await api("/api/rules");
		renderRules();
	} catch (error) {
		showError(error);
	} finally {
		document.getElementById("rules-loading").hidden = true;
	}
}

function renderRules(focus = null) {
	ruleList.replaceChildren(...rules.map(ruleRow));
	const defaultRule = rules.at(-1);
	document.getElementById("rules-intro").hidden = rules.length !== 1;
	document.getElementById("default-empty").hidden = !defaultRule || defaultRule.frameIds.length > 0;
	// A move re-renders the list; the focus stays on the moved rule's button, or the other arrow at the end.
	if (focus) {
		const row = ruleList.querySelector(`[data-rule-id="${focus.id}"]`);
		(row?.querySelector(`[data-action="${focus.action}"]:not(:disabled)`)
			?? row?.querySelector("button:not(:disabled)"))?.focus();
	}
}

/**
 * Up and down are disabled exactly where the API answers 409: up on the top rule, down just above the
 * default rule. The default rule can't be moved or deleted.
 */
function ruleRow(rule, index) {
	const row = clone("rule-row");
	row.dataset.ruleId = String(rule.id);
	row.querySelector(".swatch").style.backgroundColor = ruleColor(rule);
	row.querySelector(".rule-row__name").textContent = rule.name;
	row.querySelector(".rule-row__summary").textContent = summary(rule);

	const edit = row.querySelector('[data-action="edit"]');
	edit.href = `/rules/${rule.id}`;
	edit.setAttribute("aria-label", `Edit ${rule.name}`);

	const up = row.querySelector('[data-action="up"]');
	const down = row.querySelector('[data-action="down"]');
	const deleteButton = row.querySelector('[data-action="delete"]');
	if (rule.isDefault) {
		up.remove();
		down.remove();
		deleteButton.remove();
		return row;
	}
	up.setAttribute("aria-label", `Move ${rule.name} up`);
	up.disabled = index === 0;
	up.addEventListener("click", () => move(rule, "UP", up));
	down.setAttribute("aria-label", `Move ${rule.name} down`);
	down.disabled = index === rules.length - 2;
	down.addEventListener("click", () => move(rule, "DOWN", down));
	deleteButton.setAttribute("aria-label", `Delete ${rule.name}`);
	deleteButton.addEventListener("click", () => remove(rule, deleteButton));
	return row;
}

/** The API answers with every rule in the new order. A rule change changes the timeline's version. */
async function move(rule, direction, button) {
	await busy(button, async () => {
		rules = await api(`/api/rules/${rule.id}/move`, { method: "POST", json: { direction } });
		renderRules({ id: rule.id, action: direction === "UP" ? "up" : "down" });
	});
	loadWeek({ force: true });
}

async function remove(rule, button) {
	if (!confirm(`Delete the rule "${rule.name}"? This can't be undone.`)) {
		return;
	}
	await busy(button, async () => {
		await api(`/api/rules/${rule.id}`, { method: "DELETE" });
		rules = rules.filter((other) => other.id !== rule.id);
		renderRules();
		renderDevice();
		showSuccess(`Deleted "${rule.name}"`);
	});
	loadWeek({ force: true });
}

// ---------- Timeline ----------

/** Shows the week a date is in, loading it unless it already was. */
async function showWeek(date, button) {
	week = weekOf(date).from;
	renderDays();
	await busy(button, () => loadWeek());
}

/**
 * Loads the week shown. Forced, it asks again even for a loaded week, to see whether the version changed:
 * a new version drops every week loaded before (D39).
 */
async function loadWeek({ force = false } = {}) {
	const from = week;
	if (isLoaded(timeline, from) && !force) {
		return;
	}
	dayList.setAttribute("aria-busy", "true");
	try {
		const response = await api(`/api/timeline?from=${from}&to=${addDays(from.slice(0, 10), 7)}T00:00:00`);
		timeline = addRange(timeline, from, response);
	} catch (error) {
		showError(error);
	} finally {
		dayList.removeAttribute("aria-busy");
	}
	renderDays();
}

function renderDays() {
	document.getElementById("week-range").textContent = formatWeek(week.slice(0, 10));
	if (!isLoaded(timeline, week)) {
		dayList.replaceChildren();
		return;
	}
	const now = toLocal(new Date());
	drawDays(dayList, daysOf(timeline, week), {
		ruleOf: (id) => timeline.rules.get(id),
		today: now.slice(0, 10),
		nowHour: Number(now.slice(11, 13)) + Number(now.slice(14, 16)) / 60,
	});
}

/**
 * Today, at the top of the days. On a desktop the days scroll inside the timeline, so the page opens on
 * today; on a phone the page itself scrolls, and only "Today" goes there, so the now card stays first.
 */
function scrollToToday({ page }) {
	const day = dayList.querySelector(".day--today");
	if (!day) {
		return;
	}
	if (dayList.scrollHeight > dayList.clientHeight) {
		dayList.scrollTop = day.offsetTop - dayList.offsetTop;
	} else if (page) {
		day.scrollIntoView({ block: "start" });
	}
}

// ---------- Now on the frame ----------

async function loadDevice() {
	try {
		device = await api("/api/device");
		renderDevice();
	} catch (error) {
		showError(error);
	} finally {
		document.getElementById("now-loading").hidden = true;
	}
}

function renderDevice() {
	if (!device) {
		return;
	}
	document.getElementById("now-body").hidden = false;
	const image = document.getElementById("now-image");
	const placeholder = document.getElementById("now-placeholder");
	const status = document.getElementById("now-status");
	const next = document.getElementById("now-next");
	const ruleLine = document.getElementById("now-rule");

	if (!device.lastRequestAt) {
		image.hidden = true;
		placeholder.hidden = false;
		placeholder.textContent = "Nothing shown yet";
		ruleLine.hidden = true;
		status.textContent = "The frame hasn't connected yet.";
		next.hidden = true;
		return;
	}

	const shown = device.frameId !== null;
	image.hidden = !shown;
	placeholder.hidden = shown;
	if (shown) {
		const src = `/api/frames/${device.frameId}/image.png`;
		if (image.getAttribute("src") !== src) {
			image.src = src;
		}
	} else {
		placeholder.textContent = "This frame was deleted";
	}

	const rule = rules.find((other) => other.id === device.ruleId);
	ruleLine.hidden = false;
	ruleLine.querySelector(".swatch").style.backgroundColor = rule ? ruleColor(rule) : "transparent";
	document.getElementById("now-rule-name").textContent = rule ? rule.name : "A deleted rule";

	const last = new Date(device.lastRequestAt);
	status.classList.toggle("now__status--offline", !device.online);
	status.textContent = device.online
		? `Online · updated ${formatWhen(last)}, ${formatAgo(last)}`
		: `Offline, no update since ${formatWhen(last)} (${formatAgo(last)})`;
	// The next wake: the next 3-hour mark plus 1 minute (D3, D25).
	next.hidden = !device.online;
	next.textContent = `Next update around ${formatTime(nextWake())}`;
}
