// The frames page: the library as a grid, each frame's whole image, rename and delete.
import { api, ApiError } from "./api.js";
import { busy, clearFieldErrors, clone, errorText, initDialog, showError, showFieldErrors, showSuccess } from "./ui.js";

const grid = document.getElementById("frame-grid");
const imageDialog = document.getElementById("image-dialog");
const renameDialog = document.getElementById("rename-dialog");
const renameForm = document.getElementById("rename-form");
const renameInput = document.getElementById("rename-name");

/** Newest first, as the API lists them. */
let frames = [];
/** To show where each frame is used. */
let rules = [];
let renaming = null;

initDialog(imageDialog);
initDialog(renameDialog);
renameForm.addEventListener("submit", (event) => {
	event.preventDefault();
	busy(document.getElementById("rename-save"), rename);
});
load();

async function load() {
	try {
		[frames, rules] = await Promise.all([api("/api/frames"), api("/api/rules")]);
		render();
	} catch (error) {
		showError(error);
	} finally {
		document.getElementById("loading").hidden = true;
	}
}

function render() {
	const empty = frames.length === 0;
	document.getElementById("empty").hidden = !empty;
	document.getElementById("new-link").hidden = empty;
	grid.replaceChildren(...frames.map(card));
}

function card(frame) {
	const item = clone("frame-card");
	const thumb = item.querySelector('[data-action="view"]');
	thumb.setAttribute("aria-label", `View ${frame.name}`);
	thumb.querySelector("img").src = imageUrl(frame);
	thumb.addEventListener("click", () => view(frame));
	item.querySelector(".frame-card__name").textContent = frame.name;
	item.querySelector(".frame-card__usage").textContent = usage(frame);

	const renameButton = item.querySelector('[data-action="rename"]');
	renameButton.setAttribute("aria-label", `Rename ${frame.name}`);
	renameButton.addEventListener("click", () => openRename(frame));
	const deleteButton = item.querySelector('[data-action="delete"]');
	deleteButton.setAttribute("aria-label", `Delete ${frame.name}`);
	deleteButton.addEventListener("click", () => remove(frame, deleteButton));
	return item;
}

function imageUrl(frame) {
	return `/api/frames/${frame.id}/image.png`;
}

/** The rules whose rotation has the frame, highest first. */
function usage(frame) {
	const names = rules.filter((rule) => rule.frameIds.includes(frame.id)).map((rule) => rule.name);
	return names.length > 0 ? `Used by ${names.join(", ")}` : "Not used by any rule";
}

function view(frame) {
	document.getElementById("image-dialog-title").textContent = frame.name;
	const image = document.getElementById("image-dialog-image");
	image.src = imageUrl(frame);
	image.alt = frame.name;
	imageDialog.showModal();
}

function openRename(frame) {
	renaming = frame;
	renameInput.value = frame.name;
	clearFieldErrors(renameForm);
	renameDialog.showModal();
	renameInput.select();
}

async function rename() {
	const name = renameInput.value.trim();
	if (name === "") {
		showFieldErrors(renameForm, [{ field: "name", message: "Enter a name" }]);
		return;
	}
	try {
		const renamed = await api(`/api/frames/${renaming.id}`, { method: "PATCH", json: { name } });
		frames = frames.map((frame) => (frame.id === renamed.id ? renamed : frame));
		renameDialog.close();
		render();
		showSuccess(`Renamed to "${renamed.name}"`);
	} catch (error) {
		// The dialog covers the message area, so every error goes under the name.
		const errors = error instanceof ApiError && error.errors.length > 0
			? error.errors
			: [{ field: "name", message: errorText(error) }];
		showFieldErrors(renameForm, errors);
	}
}

/** A frame a rule uses can't be deleted: the 409's detail names the rules (D27). */
async function remove(frame, button) {
	if (!confirm(`Delete "${frame.name}"? This can't be undone.`)) {
		return;
	}
	await busy(button, async () => {
		await api(`/api/frames/${frame.id}`, { method: "DELETE" });
		frames = frames.filter((other) => other.id !== frame.id);
		render();
		showSuccess(`Deleted "${frame.name}"`);
	});
}
