// What every page shares (D42): the message area, field errors under their section, and buttons that
// are disabled while their request runs.
import { ApiError } from "./api.js";

const CONFIRMATION_MS = 5000;

let hideTimer;

/** Shows a confirmation in the message area; it goes away by itself. */
export function showSuccess(text) {
	show(text, "success");
	hideTimer = setTimeout(clearMessage, CONFIRMATION_MS);
}

/** Shows an error in the message area, until the next message or until it's dismissed. */
export function showError(error) {
	show(errorText(error), "error");
}

export function clearMessage() {
	clearTimeout(hideTimer);
	document.getElementById("messages").replaceChildren();
}

/** The API's own words for an ApiError; anything else is a bug in the page. */
export function errorText(error) {
	if (error instanceof ApiError) {
		return error.message;
	}
	console.error(error);
	return "Something went wrong. Reload the page and try again.";
}

function show(text, kind) {
	clearMessage();
	const message = clone("message-template");
	message.classList.add(`message--${kind}`);
	message.querySelector(".message__text").textContent = text;
	message.querySelector(".message__close").addEventListener("click", clearMessage);
	document.getElementById("messages").append(message);
}

/** The section a field error belongs to: the request field, before any index (hours[0] → hours). */
export function fieldOf(field) {
	return field.split("[")[0];
}

/**
 * Shows each `{ field, message }` under its section, the element whose data-error-for is the field, and
 * scrolls to the first one. Returns the errors that have no section.
 */
export function showFieldErrors(root, errors) {
	clearFieldErrors(root);
	const unplaced = [];
	for (const error of errors) {
		const slot = root.querySelector(`[data-error-for="${CSS.escape(fieldOf(error.field))}"]`);
		if (!slot) {
			unplaced.push(error);
			continue;
		}
		const text = sentence(error.message);
		slot.textContent = slot.textContent ? `${slot.textContent}\n${text}` : text;
		slot.hidden = false;
	}
	root.querySelector("[data-error-for]:not([hidden])")?.parentElement.scrollIntoView({ block: "center" });
	return unplaced;
}

export function clearFieldErrors(root) {
	for (const slot of root.querySelectorAll("[data-error-for]")) {
		slot.textContent = "";
		slot.hidden = true;
	}
}

/** The API's messages start in lower case ("must not be blank"). */
function sentence(text) {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Runs a request with its button disabled, so nothing is submitted twice. An error goes to the message
 * area, and the result is then undefined.
 */
export async function busy(button, task) {
	if (button.disabled) {
		return undefined;
	}
	button.disabled = true;
	button.setAttribute("aria-busy", "true");
	try {
		return await task();
	} catch (error) {
		showError(error);
		return undefined;
	} finally {
		button.disabled = false;
		button.removeAttribute("aria-busy");
	}
}

/** A copy of a <template>'s element, so the pages build no HTML strings (D42). */
export function clone(templateId) {
	return document.getElementById(templateId).content.firstElementChild.cloneNode(true);
}
