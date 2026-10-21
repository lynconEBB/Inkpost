// The schedule page: the rules, highest first, moved and deleted here and edited on the rule form (D38).
import { api } from "./api.js";
import { ruleColor } from "./colors.js";
import { summary } from "./rule-summary.js";
import { busy, clone, showError, showSuccess } from "./ui.js";

const ruleList = document.getElementById("rule-list");

/** Highest first, so the default rule is last. */
let rules = [];

loadRules();

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

/** The API answers with every rule in the new order. */
async function move(rule, direction, button) {
	await busy(button, async () => {
		rules = await api(`/api/rules/${rule.id}/move`, { method: "POST", json: { direction } });
		renderRules({ id: rule.id, action: direction === "UP" ? "up" : "down" });
	});
}

async function remove(rule, button) {
	if (!confirm(`Delete the rule "${rule.name}"? This can't be undone.`)) {
		return;
	}
	await busy(button, async () => {
		await api(`/api/rules/${rule.id}`, { method: "DELETE" });
		rules = rules.filter((other) => other.id !== rule.id);
		renderRules();
		showSuccess(`Deleted "${rule.name}"`);
	});
}
