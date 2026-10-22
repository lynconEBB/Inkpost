import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { coverScale, coverSize, fitScale, photoRect, visiblePart } from "../../main/resources/static/js/crop.js";

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

describe("the photo's place", () => {
	test("covers the frame, centered, at scale 1", () => {
		assert.deepEqual(photoRect(4032, 3024, 1, 400, 240), { left: 0, top: -60, width: 800, height: 600 });
		assert.deepEqual(photoRect(1920, 1080, 1, 400, 240), { left: -26, top: 0, width: 853, height: 480 });
	});

	test("keeps its center when the scale changes", () => {
		assert.deepEqual(photoRect(4032, 3024, 0.5, 400, 240), { left: 200, top: 90, width: 400, height: 300 });
		assert.deepEqual(photoRect(4032, 3024, 2, 400, 240), { left: -400, top: -360, width: 1600, height: 1200 });
	});

	test("goes anywhere, in whole pixels", () => {
		assert.deepEqual(photoRect(1600, 960, 0.25, -30.4, 600.6), { left: -130, top: 541, width: 200, height: 120 });
	});

	test("is at least a pixel", () => {
		assert.deepEqual(photoRect(1600, 960, 0.0001, 10, 10), { left: 10, top: 10, width: 1, height: 1 });
	});

	test("shows the whole photo at the fit scale", () => {
		const portrait = photoRect(3024, 4032, fitScale(3024, 4032), 400, 240);
		assert.equal(portrait.height, 480);
		assert.equal(portrait.width, 360);
		const wide = photoRect(1920, 1080, fitScale(1920, 1080), 400, 240);
		assert.equal(wide.width, 800);
		assert.equal(wide.height, 450);
		assert.equal(fitScale(1600, 960), 1);
	});
});

describe("the visible part", () => {
	test("is the whole rectangle inside the frame", () => {
		const rect = { left: 10, top: 20, width: 30, height: 40 };
		assert.deepEqual(visiblePart(rect), rect);
	});

	test("is cut at the frame's edges", () => {
		assert.deepEqual(visiblePart({ left: -60, top: -10, width: 1600, height: 100 }), {
			left: 0,
			top: 0,
			width: 800,
			height: 90,
		});
		assert.deepEqual(visiblePart({ left: 790, top: 470, width: 50, height: 50 }), {
			left: 790,
			top: 470,
			width: 10,
			height: 10,
		});
	});

	test("is null for a rectangle outside the frame, or only touching it", () => {
		assert.equal(visiblePart({ left: 800, top: 0, width: 10, height: 10 }), null);
		assert.equal(visiblePart({ left: -10, top: 0, width: 10, height: 10 }), null);
		assert.equal(visiblePart({ left: 0, top: 480, width: 10, height: 10 }), null);
	});
});
