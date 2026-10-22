import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_COLOR, PALETTE, ruleColor } from "../../main/resources/static/js/colors.js";
import { range } from "../../main/resources/static/js/time.js";

/** WCAG's contrast ratio between two #rrggbb colors. */
function contrast(a, b) {
	const luminance = (hex) => {
		const [r, g, b] = [1, 3, 5].map((i) => {
			const c = parseInt(hex.slice(i, i + 2), 16) / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

test("the default rule is always gray", () => {
	assert.equal(ruleColor({ id: 1, isDefault: true }), DEFAULT_COLOR);
	assert.equal(ruleColor({ id: 5, isDefault: true }), DEFAULT_COLOR);
	assert.ok(!PALETTE.includes(DEFAULT_COLOR));
});

test("a rule keeps its color", () => {
	assert.equal(ruleColor({ id: 7, isDefault: false }), ruleColor({ id: 7, isDefault: false }));
});

test("8 rules in a row get 8 different colors", () => {
	const colors = range(8, 2).map((id) => ruleColor({ id, isDefault: false }));
	assert.equal(new Set(colors).size, 8);
	assert.equal(new Set(PALETTE).size, 8);
});

test("every color stands apart from white, so hatched and solid are easy to tell apart", () => {
	for (const color of [...PALETTE, DEFAULT_COLOR]) {
		assert.ok(contrast(color, "#ffffff") >= 4.5, `${color}: ${contrast(color, "#ffffff").toFixed(2)}`);
	}
});
