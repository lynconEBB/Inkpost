// The rule form: creates or edits a rule (D38). Its sections map to RuleRequest's fields (D41), and "Until" is
// the last block shown, sent as the exclusive end just after it (D45).
import { api, ApiError } from "./api.js";
import { MONTHS, summary, WEEKDAYS } from "./rule-summary.js";
import {
	atBlock,
	BLOCK_HOURS,
	BLOCKS,
	blocksOfHours,
	blockTime,
	endToUntil,
	hoursOfBlocks,
	localOf,
	pad,
	range,
	splitBlock,
	untilToEnd,
} from "./time.js";
import { busy, clearFieldErrors, clearMessage, clone, initDialog, showError, showFieldErrors, showFormError } from "./ui.js";

/**
 * The chips of each pattern field, and how the checked ones become the request's list. The time of day is in
 * 3-hour blocks (D26), sent as their hours.
 */
const PATTERNS = {
	hours: {
		values: range(BLOCKS),
		label: (block) => `${pad(block * BLOCK_HOURS)}–${pad((block + 1) * BLOCK_HOURS)}`,
		toList: hoursOfBlocks,
		fromList: blocksOfHours,
	},
	weekdays: { values: range(7, 1), label: (day) => WEEKDAYS[day - 1] },
	daysOfMonth: { values: range(31, 1), label: String },
	months: { values: range(12, 1), label: (month) => MONTHS[month - 1] },
};

const ruleId = document.getElementById("rule-page").dataset.ruleId ?? null;
const form = document.getElementById("rule-form");
const nameInput = document.getElementById("name");
const frameList = document.getElementById("rule-frames");
const picker = document.getElementById("picker");
const deleteButton = document.getElementById("delete");

/** "Starts" is when the first block begins; "Until" offers the blocks with their end, as the last one shown. */
const start = datePair("start", 0, blockTime);
const until = datePair("until", BLOCKS - 1, (block) => `${blockTime(block)}–${pad((block + 1) * BLOCK_HOURS)}:00`);

/** The rule being edited, or null for a new one. */
let rule = null;
let isDefault = false;
/** Every frame, by ID, newest first. */
let library = new Map();
/** The rotation, in order; a frame can be in it more than once. */
let frameIds = [];

initDialog(picker);
form.addEventListener("input", (event) => {
	clearSectionError(event.target);
	showSummary();
});
form.addEventListener("submit", (event) => {
	event.preventDefault();
	busy(document.getElementById("save"), save);
});
deleteButton.addEventListener("click", remove);
document.getElementById("add-frames").addEventListener("click", () => picker.showModal());
for (const [field, pattern] of Object.entries(PATTERNS)) {
	setUpPattern(field, pattern);
}
load();

async function load() {
	try {
		const [frames, loaded] = await Promise.all([api("/api/frames"), ruleId ? api(`/api/rules/${ruleId}`) : null]);
		library = new Map(frames.map((frame) => [frame.id, frame]));
		rule = loaded;
		fill();
		form.hidden = false;
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) {
			document.getElementById("missing").hidden = false;
		} else {
			showError(error);
		}
	} finally {
		document.getElementById("loading").hidden = true;
	}
}

/** Shows the rule, or a new rule's defaults: every value, no window, no frames. */
function fill() {
	isDefault = rule?.isDefault ?? false;
	nameInput.value = rule?.name ?? "";
	document.getElementById("default-note").hidden = !isDefault;
	for (const section of form.querySelectorAll("[data-window], [data-pattern]")) {
		section.hidden = isDefault;
	}
	if (rule?.startAt) {
		setDate(start, splitBlock(localOf(rule.startAt)));
	}
	if (rule?.endAt) {
		setDate(until, endToUntil(localOf(rule.endAt)));
	}
	for (const [field, pattern] of Object.entries(PATTERNS)) {
		const values = rule ? (pattern.fromList ?? same)(rule[field]) : pattern.values;
		const section = patternSection(field);
		for (const input of section.querySelectorAll(".chip__input")) {
			input.checked = values.includes(Number(input.value));
		}
		// A section that means every value is one line, so a typical rule is short on a phone.
		showChips(section, values.length < pattern.values.length);
	}
	frameIds = rule ? [...rule.frameIds] : [];
	deleteButton.hidden = !rule || isDefault;
	fillPicker();
	renderFrames();
}

function same(values) {
	return values;
}

// ---------- Starts and Until ----------

function datePair(prefix, defaultBlock, label) {
	const pair = {
		date: document.getElementById(`${prefix}-date`),
		block: document.getElementById(`${prefix}-block`),
		clear: document.getElementById(`${prefix}-clear`),
		defaultBlock,
	};
	pair.block.replaceChildren(...range(BLOCKS).map((block) => new Option(label(block), String(block))));
	pair.block.value = String(defaultBlock);
	pair.date.addEventListener("input", () => syncDate(pair));
	pair.clear.addEventListener("click", () => {
		setDate(pair, null);
		showSummary();
		pair.date.focus();
	});
	return pair;
}

function setDate(pair, value) {
	pair.date.value = value?.date ?? "";
	pair.block.value = String(value?.block ?? pair.defaultBlock);
	syncDate(pair);
}

/** A block only means something with a date. */
function syncDate(pair) {
	const empty = pair.date.value === "";
	pair.block.disabled = empty;
	pair.clear.hidden = empty;
}

// ---------- Pattern chips ----------

function setUpPattern(field, pattern) {
	const section = patternSection(field);
	section.querySelector("[data-chips]").replaceChildren(
		...pattern.values.map((value) => chip(field, value, pattern.label(value))));
	section.querySelector("[data-change]").addEventListener("click", () => {
		showChips(section, true);
		section.querySelector(".chip__input").focus();
	});
	section.querySelector("[data-all]").addEventListener("click", () => checkAll(section, true));
	section.querySelector("[data-none]").addEventListener("click", () => checkAll(section, false));
}

function chip(field, value, label) {
	const item = clone("chip");
	const input = item.querySelector(".chip__input");
	input.id = `${field}-${value}`;
	input.value = String(value);
	const text = item.querySelector(".chip__label");
	text.htmlFor = input.id;
	text.textContent = label;
	return item;
}

function patternSection(field) {
	return form.querySelector(`[data-pattern="${field}"]`);
}

function showChips(section, shown) {
	section.querySelector(".pattern__every").hidden = shown;
	section.querySelector(".pattern__body").hidden = !shown;
}

function checkAll(section, checked) {
	for (const input of section.querySelectorAll(".chip__input")) {
		input.checked = checked;
	}
	clearSectionError(section);
	showSummary();
}

function checked(field) {
	return [...patternSection(field).querySelectorAll(".chip__input:checked")].map((input) => Number(input.value));
}

// ---------- Frames ----------

function renderFrames(focus = null) {
	frameList.replaceChildren(...frameIds.map(frameRow));
	document.getElementById("rule-frames-empty").hidden = frameIds.length > 0;
	document.getElementById("default-empty").hidden = !(isDefault && frameIds.length === 0);
	document.getElementById("no-library").hidden = library.size > 0;
	document.getElementById("add-frames").hidden = library.size === 0;
	clearSectionError(frameList);
	updateBadges();
	showSummary();
	// Moving a frame keeps the focus on its button, so the arrows can be pressed again.
	if (focus) {
		const row = frameList.children[focus.index];
		const button = row?.querySelector(`[data-action="${focus.action}"]:not(:disabled)`)
			?? row?.querySelector("button:not(:disabled)");
		button?.focus();
	}
}

function frameRow(id, index) {
	const row = clone("rule-frame");
	const name = frameName(id);
	row.querySelector("img").src = imageUrl(id);
	row.querySelector(".rule-frame__name").textContent = name;
	const up = row.querySelector('[data-action="up"]');
	up.setAttribute("aria-label", `Move ${name} up`);
	up.disabled = index === 0;
	up.addEventListener("click", () => moveFrame(index, -1, "up"));
	const down = row.querySelector('[data-action="down"]');
	down.setAttribute("aria-label", `Move ${name} down`);
	down.disabled = index === frameIds.length - 1;
	down.addEventListener("click", () => moveFrame(index, 1, "down"));
	const removeButton = row.querySelector('[data-action="remove"]');
	removeButton.setAttribute("aria-label", `Remove ${name}`);
	removeButton.addEventListener("click", () => {
		frameIds.splice(index, 1);
		renderFrames({ index: Math.min(index, frameIds.length - 1), action: "remove" });
	});
	return row;
}

function moveFrame(index, step, action) {
	const target = index + step;
	[frameIds[index], frameIds[target]] = [frameIds[target], frameIds[index]];
	renderFrames({ index: target, action });
}

/** Every frame, newest first; each tap adds one at the end of the list. */
function fillPicker() {
	document.getElementById("picker-grid").replaceChildren(...[...library.values()].map((frame) => {
		const item = clone("picker-item");
		const button = item.querySelector(".picker-item");
		button.dataset.frameId = String(frame.id);
		item.querySelector("img").src = imageUrl(frame.id);
		item.querySelector(".picker-item__name").textContent = frame.name;
		button.addEventListener("click", () => {
			frameIds.push(frame.id);
			renderFrames();
		});
		return item;
	}));
}

/** How many times each frame is in the list. */
function updateBadges() {
	for (const button of document.querySelectorAll("#picker-grid .picker-item")) {
		const id = Number(button.dataset.frameId);
		const count = frameIds.filter((frameId) => frameId === id).length;
		const badge = button.querySelector(".badge");
		badge.hidden = count === 0;
		badge.textContent = `${count}×`;
		const name = frameName(id);
		button.setAttribute("aria-label", count === 0 ? `Add ${name}` : `Add ${name}, ${count} in the list`);
	}
}

function frameName(id) {
	return library.get(id)?.name ?? `Frame ${id}`;
}

function imageUrl(id) {
	return `/api/frames/${id}/image.png`;
}

// ---------- Summary, save and delete ----------

/** A section's error goes away once the section is changed, rather than staying until the next Save. */
function clearSectionError(element) {
	const slot = element.closest(".form-section")?.querySelector("[data-error-for]");
	if (slot) {
		slot.textContent = "";
		slot.hidden = true;
	}
}

function showSummary() {
	document.getElementById("summary").textContent = summary({ ...request(), isDefault });
}

/** The RuleRequest: a field with every value checked is null, which means every value (D41). */
function request() {
	const body = { name: nameInput.value.trim(), startAt: null, endAt: null, frameIds };
	for (const [field, pattern] of Object.entries(PATTERNS)) {
		const values = checked(field);
		body[field] = isDefault || values.length === pattern.values.length ? null : (pattern.toList ?? same)(values);
	}
	if (!isDefault && start.date.value) {
		body.startAt = atBlock(start.date.value, Number(start.block.value));
	}
	if (!isDefault && until.date.value) {
		body.endAt = untilToEnd(until.date.value, Number(until.block.value));
	}
	return body;
}

/** What the API would reject anyway, said in the form's own words. */
function problems(body) {
	const errors = [];
	if (body.name === "") {
		errors.push({ field: "name", message: "Enter a name" });
	}
	if (isDefault) {
		return errors;
	}
	for (const field of Object.keys(PATTERNS)) {
		if (checked(field).length === 0) {
			errors.push({ field, message: "Select at least one" });
		}
	}
	// Local date-times compare as text.
	if (body.startAt && body.endAt && body.endAt <= body.startAt) {
		errors.push({ field: "endAt", message: "The last block must be on or after the start" });
	}
	if (body.frameIds.length === 0) {
		errors.push({ field: "frameIds", message: "Add at least one frame" });
	}
	return errors;
}

async function save() {
	clearMessage();
	clearFieldErrors(form);
	const body = request();
	const errors = problems(body);
	if (errors.length > 0) {
		showFieldErrors(form, errors);
		return;
	}
	try {
		await api(rule ? `/api/rules/${rule.id}` : "/api/rules", { method: rule ? "PUT" : "POST", json: body });
	} catch (error) {
		showFormError(form, error);
		return;
	}
	location.assign("/");
}

async function remove() {
	if (!confirm(`Delete the rule "${rule.name}"? This can't be undone.`)) {
		return;
	}
	await busy(deleteButton, async () => {
		await api(`/api/rules/${rule.id}`, { method: "DELETE" });
		location.assign("/");
	});
}
