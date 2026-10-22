import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cssWidth, fitZoom, framePoint, scrollToKeep, stepZoom } from "../../main/resources/static/js/viewport.js";

describe("the zoom", () => {
	test("to fit is the smaller of the area's width and height, in screen pixels", () => {
		assert.equal(fitZoom(400, 600, 1), 0.5);
		assert.equal(fitZoom(1600, 480, 1), 1);
		assert.equal(fitZoom(400, 240, 2), 1);
	});

	test("sets the canvas's width in CSS pixels", () => {
		assert.equal(cssWidth(1, 1), 800);
		assert.equal(cssWidth(1, 2), 400);
		assert.equal(cssWidth(4, 2), 1600);
	});

	test("steps in and out through the zooms and Fit's", () => {
		assert.equal(stepZoom(0.5, 0.5, 1), 1);
		assert.equal(stepZoom(1, 0.5, 1), 2);
		assert.equal(stepZoom(2, 0.5, -1), 1);
		assert.equal(stepZoom(1, 0.5, -1), 0.5);
		assert.equal(stepZoom(1.4, 1.4, 1), 2);
		assert.equal(stepZoom(2, 1.4, -1), 1.4);
		assert.equal(stepZoom(1.4, 1.4, -1), 1);
	});

	test("stops at the ends", () => {
		assert.equal(stepZoom(16, 0.5, 1), 16);
		assert.equal(stepZoom(0.5, 0.5, -1), 0.5);
		assert.equal(stepZoom(1, 1.4, -1), 1);
	});

	test("skips a zoom close to the current one", () => {
		assert.equal(stepZoom(1, 1.02, 1), 2);
		assert.equal(stepZoom(2, 1.02, -1), 1.02);
		assert.equal(stepZoom(1.02, 1.02, -1), 1.02);
		assert.equal(stepZoom(1.9999999, 0.5, 1), 4);
	});
});

describe("a point on the screen", () => {
	const box = { left: 100, top: 50, width: 400, height: 240 };

	test("is the frame pixel under it", () => {
		assert.deepEqual(framePoint(100, 50, box), { x: 0, y: 0 });
		assert.deepEqual(framePoint(101.9, 51.9, box), { x: 3, y: 3 });
		assert.deepEqual(framePoint(499.9, 289.9, box), { x: 799, y: 479 });
	});

	test("can be outside the frame", () => {
		assert.deepEqual(framePoint(99, 49, box), { x: -2, y: -2 });
		assert.deepEqual(framePoint(500, 290, box), { x: 800, y: 480 });
	});

	test("stays over the same part of the canvas when zooming", () => {
		// The canvas doubles from 100 px at 0 to 200 px at -20: the point at 30 was 30 % in, so
		// it is now at 40, and scrolling 10 brings it back.
		assert.equal(scrollToKeep(30, { start: 0, size: 100 }, { start: -20, size: 200 }), 10);
		assert.equal(scrollToKeep(30, { start: 0, size: 100 }, { start: 0, size: 100 }), 0);
		assert.equal(scrollToKeep(60, { start: 10, size: 400 }, { start: 10, size: 200 }), -25);
	});
});
