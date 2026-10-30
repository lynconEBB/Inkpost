import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	coverScale,
	coverSize,
	cropCoverScale,
	cropPhoto,
	fitScale,
	photoRect,
	visiblePart,
	wholePhoto,
} from "../../main/resources/static/js/crop.js";

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

describe("the crop", () => {
	// A 4:3 photo at half the cover size, 400 × 300 in the middle of the frame: 4032 / 400 photo pixels per
	// frame pixel.
	const photo = {
		source: { width: 4032, height: 3024 },
		crop: wholePhoto(4032, 3024),
		scale: 0.5,
		centerX: 400,
		centerY: 240,
	};
	const rectOf = (layer) =>
		photoRect(layer.source.width, layer.source.height, layer.scale, layer.centerX, layer.centerY, layer.crop);
	const cropped = (handle, dx, dy) => ({ ...photo, ...cropPhoto(photo, handle, dx, dy) });

	test("is the whole photo at first, where the photo is", () => {
		assert.deepEqual(wholePhoto(4032, 3024), { left: 0, top: 0, width: 4032, height: 3024 });
		assert.deepEqual(rectOf(photo), { left: 200, top: 90, width: 400, height: 300 });
	});

	test("shows its part of the photo, at the photo's size, around its center", () => {
		const crop = { left: 1008, top: 0, width: 2016, height: 3024 };
		assert.deepEqual(photoRect(4032, 3024, 0.5, 400, 240, crop), { left: 300, top: 90, width: 200, height: 300 });
	});

	test("moves the edge a handle holds, and the photo stays where it is", () => {
		const layer = cropped("w", 30, 99);
		close(layer.crop.left, 30 * 10.08);
		close(layer.crop.width, 370 * 10.08);
		assert.equal(layer.crop.top, 0);
		assert.equal(layer.crop.height, 3024);
		assert.deepEqual(rectOf(layer), { left: 230, top: 90, width: 370, height: 300 });
	});

	test("moves both edges a corner holds", () => {
		const layer = cropped("se", -100, -50);
		assert.deepEqual(layer.crop, { left: 0, top: 0, width: 300 * 10.08, height: 250 * 10.08 });
		assert.deepEqual(rectOf(layer), { left: 200, top: 90, width: 300, height: 250 });
	});

	test("shows the photo again when an edge goes back out, but not past the photo's edge", () => {
		const inside = cropped("n", 0, 100);
		const back = { ...inside, ...cropPhoto(inside, "n", 0, -500) };
		assert.equal(back.crop.top, 0);
		close(back.crop.height, 3024);
		assert.deepEqual(rectOf(back), rectOf(photo));
		assert.deepEqual(cropPhoto(photo, "nw", -40, -40), { crop: photo.crop, centerX: 400, centerY: 240 });
	});

	test("stops 16 pixels from the opposite edge", () => {
		assert.deepEqual(rectOf(cropped("e", -1000, 0)), { left: 200, top: 90, width: 16, height: 300 });
		assert.deepEqual(rectOf(cropped("n", 0, 1000)), { left: 200, top: 374, width: 400, height: 16 });
	});

	test("keeps an edge that's closer than that where it is", () => {
		const thin = { ...photo, crop: { left: 0, top: 0, width: 4032, height: 100.8 }, centerY: 240 };
		assert.equal(rectOf(thin).height, 10);
		const layer = { ...thin, ...cropPhoto(thin, "s", 0, -5) };
		assert.equal(rectOf(layer).height, 10);
	});

	test("goes with the photo when it moves or changes size", () => {
		const layer = cropped("w", 200, 0);
		const moved = { ...layer, centerX: layer.centerX + 10 };
		assert.deepEqual(rectOf(moved), { left: 410, top: 90, width: 200, height: 300 });
		assert.deepEqual(rectOf({ ...layer, scale: 1 }), { left: 300, top: -60, width: 400, height: 600 });
	});

	test("covers the frame at its own cover scale", () => {
		assert.equal(cropCoverScale(4032, 3024, wholePhoto(4032, 3024)), 1);
		const square = { left: 504, top: 0, width: 3024, height: 3024 };
		assert.deepEqual(photoRect(4032, 3024, cropCoverScale(4032, 3024, square), 400, 240, square), {
			left: 0,
			top: -160,
			width: 800,
			height: 800,
		});
	});
});
