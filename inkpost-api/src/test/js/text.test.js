import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { boxBetween, inBox, lineX, MIN_BOX, resizeBox, wrap } from "../../main/resources/static/js/text.js";

/** Every character 10 pixels wide. */
const measure = (text) => text.length * 10;

describe("wrapping", () => {
	test("keeps a text that fits on one line", () => {
		assert.deepEqual(wrap("Bom dia", 200, measure), ["Bom dia"]);
	});

	test("breaks between words, dropping the space at the break", () => {
		assert.deepEqual(wrap("Bom dia meu amor", 100, measure), ["Bom dia", "meu amor"]);
		assert.deepEqual(wrap("Bom dia meu amor", 70, measure), ["Bom dia", "meu", "amor"]);
	});

	test("keeps a line that exactly fits", () => {
		assert.deepEqual(wrap("abc defg", 80, measure), ["abc defg"]);
		assert.deepEqual(wrap("abc defg", 79, measure), ["abc", "defg"]);
		assert.deepEqual(wrap("abc defg", 30, measure), ["abc", "def", "g"]);
	});

	test("cuts a word wider than the box", () => {
		assert.deepEqual(wrap("coraçãozinho", 50, measure), ["coraç", "ãozin", "ho"]);
		assert.deepEqual(wrap("oi coraçãozinho", 50, measure), ["oi", "coraç", "ãozin", "ho"]);
	});

	test("keeps new lines and empty lines", () => {
		assert.deepEqual(wrap("Oi\n\nTchau", 200, measure), ["Oi", "", "Tchau"]);
		assert.deepEqual(wrap("", 200, measure), [""]);
	});

	test("keeps a character even when the box is narrower", () => {
		assert.deepEqual(wrap("ab", 5, measure), ["a", "b"]);
	});

	test("keeps the spaces inside a line", () => {
		assert.deepEqual(wrap("a  b", 200, measure), ["a  b"]);
	});
});

describe("a line", () => {
	test("starts on the left, in the middle or on the right of its box", () => {
		assert.equal(lineX(60, 200, "left"), 0);
		assert.equal(lineX(60, 200, "center"), 70);
		assert.equal(lineX(60, 200, "right"), 140);
	});

	test("starts on whole pixels", () => {
		assert.equal(lineX(60.4, 200, "center"), 69);
		assert.equal(lineX(60.4, 200, "right"), 139);
	});
});

describe("a box", () => {
	test("goes between two opposite corners, both included", () => {
		const expected = { left: 10, top: 20, width: 31, height: 11 };
		assert.deepEqual(boxBetween({ x: 10, y: 20 }, { x: 40, y: 30 }), expected);
		assert.deepEqual(boxBetween({ x: 40, y: 30 }, { x: 10, y: 20 }), expected);
		assert.deepEqual(boxBetween({ x: 40, y: 20 }, { x: 10, y: 30 }), expected);
		assert.deepEqual(boxBetween({ x: 5, y: 5 }, { x: 5, y: 5 }), { left: 5, top: 5, width: 1, height: 1 });
	});

	test("has the points inside it", () => {
		const box = { left: 10, top: 20, width: 30, height: 10 };
		assert.equal(inBox(box, { x: 10, y: 20 }), true);
		assert.equal(inBox(box, { x: 39, y: 29 }), true);
		assert.equal(inBox(box, { x: 40, y: 25 }), false);
		assert.equal(inBox(box, { x: 20, y: 30 }), false);
		assert.equal(inBox(box, { x: 9, y: 25 }), false);
	});
});

describe("resizing a box", () => {
	const box = { left: 100, top: 100, width: 200, height: 100 };

	test("moves only the edges its handle holds", () => {
		assert.deepEqual(resizeBox(box, "e", 50, 30), { left: 100, top: 100, width: 250, height: 100 });
		assert.deepEqual(resizeBox(box, "s", 50, 30), { left: 100, top: 100, width: 200, height: 130 });
		assert.deepEqual(resizeBox(box, "w", 50, 30), { left: 150, top: 100, width: 150, height: 100 });
		assert.deepEqual(resizeBox(box, "n", 50, 30), { left: 100, top: 130, width: 200, height: 70 });
	});

	test("moves two edges from a corner", () => {
		assert.deepEqual(resizeBox(box, "se", 10, 20), { left: 100, top: 100, width: 210, height: 120 });
		assert.deepEqual(resizeBox(box, "nw", -10, -20), { left: 90, top: 80, width: 210, height: 120 });
		assert.deepEqual(resizeBox(box, "ne", 10, -20), { left: 100, top: 80, width: 210, height: 120 });
		assert.deepEqual(resizeBox(box, "sw", -10, 20), { left: 90, top: 100, width: 210, height: 120 });
	});

	test("stops at the smallest size, without crossing the other edge", () => {
		assert.deepEqual(resizeBox(box, "e", -500, 0), { left: 100, top: 100, width: MIN_BOX, height: 100 });
		assert.deepEqual(resizeBox(box, "w", 500, 0), { left: 300 - MIN_BOX, top: 100, width: MIN_BOX, height: 100 });
		assert.deepEqual(resizeBox(box, "n", 0, 500), { left: 100, top: 200 - MIN_BOX, width: 200, height: MIN_BOX });
		assert.deepEqual(resizeBox(box, "s", 0, -500), { left: 100, top: 100, width: 200, height: MIN_BOX });
	});
});
