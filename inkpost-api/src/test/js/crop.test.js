import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { centered, clampOffset, coverScale, coverSize } from "../../main/resources/static/js/crop.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);

describe("the cover scale", () => {
	test("fits the height of a photo wider than 5:3", () => {
		close(coverScale(1920, 1080), 480 / 1080);
		const size = coverSize(1920, 1080);
		close(size.width, 853.3333333333334);
		assert.equal(size.height, 480);
	});

	test("fits the width of a landscape photo taller than 5:3, like a phone's 4:3", () => {
		close(coverScale(4032, 3024), 800 / 4032);
		assert.deepEqual(coverSize(4032, 3024), { width: 800, height: 600 });
	});

	test("fits the width of a portrait photo", () => {
		close(coverScale(3024, 4032), 800 / 3024);
		const size = coverSize(3024, 4032);
		assert.equal(size.width, 800);
		close(size.height, 1066.6666666666667);
	});

	test("is exact for a 5:3 photo, and scales a small one up", () => {
		assert.deepEqual(coverSize(1600, 960), { width: 800, height: 480 });
		close(coverScale(400, 240), 2);
		assert.deepEqual(coverSize(400, 240), { width: 800, height: 480 });
	});
});

describe("the offset", () => {
	test("starts centered", () => {
		const wide = centered(coverSize(1920, 1080));
		close(wide.x, -26.666666666666686);
		assert.equal(wide.y, 0);
		assert.deepEqual(centered(coverSize(4032, 3024)), { x: 0, y: -60 });
	});

	test("is clamped so the frame stays covered", () => {
		const size = coverSize(4032, 3024);
		assert.deepEqual(clampOffset({ x: 0, y: 10 }, size), { x: 0, y: 0 });
		assert.deepEqual(clampOffset({ x: 0, y: -500 }, size), { x: 0, y: -120 });
		assert.deepEqual(clampOffset({ x: 0, y: -45 }, size), { x: 0, y: -45 });
	});

	test("only moves sideways for a photo wider than 5:3", () => {
		const size = coverSize(1920, 1080);
		const offset = clampOffset({ x: -40, y: -40 }, size);
		assert.equal(offset.x, -40);
		assert.equal(offset.y, 0);
		close(clampOffset({ x: -400, y: 0 }, size).x, 800 - 853.3333333333334);
	});

	test("only moves up and down for a portrait photo", () => {
		const size = coverSize(3024, 4032);
		const offset = clampOffset({ x: -40, y: -40 }, size);
		assert.equal(offset.x, 0);
		assert.equal(offset.y, -40);
	});

	test("can't move a 5:3 photo at all", () => {
		assert.deepEqual(clampOffset({ x: -30, y: 30 }, coverSize(1600, 960)), { x: 0, y: 0 });
	});
});
