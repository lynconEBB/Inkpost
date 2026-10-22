import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { adjust, dither, grayscale, render, toRgba } from "../../main/resources/static/js/dither.js";

const WIDTH = 800;
const HEIGHT = 480;
const METHODS = ["floyd-steinberg", "atkinson", "threshold"];

const flat = (value) => new Float32Array(WIDTH * HEIGHT).fill(value);
const blackShare = (pixels) => pixels.filter((value) => value === 0).length / pixels.length;

/** A left-to-right ramp from black to white, the hardest case for streaks and stray values. */
function ramp() {
	const gray = new Float32Array(WIDTH * HEIGHT);
	for (let i = 0; i < gray.length; i++) {
		gray[i] = ((i % WIDTH) / (WIDTH - 1)) * 255;
	}
	return gray;
}

describe("dithering", () => {
	for (const method of METHODS) {
		test(`${method} makes only black and white`, () => {
			const result = dither(ramp(), WIDTH, HEIGHT, method);

			assert.equal(result.length, WIDTH * HEIGHT);
			assert.ok(result.every((value) => value === 0 || value === 255));
		});
	}

	test("Floyd–Steinberg makes a flat 50% gray about half black", () => {
		const share = blackShare(dither(flat(127.5), WIDTH, HEIGHT, "floyd-steinberg"));

		assert.ok(Math.abs(share - 0.5) < 0.01, `${share} black`);
	});

	test("Atkinson makes a flat 50% gray about half black", () => {
		const share = blackShare(dither(flat(127.5), WIDTH, HEIGHT, "atkinson"));

		assert.ok(Math.abs(share - 0.5) < 0.05, `${share} black`);
	});

	test("Floyd–Steinberg keeps the average gray of a ramp", () => {
		const share = blackShare(dither(ramp(), WIDTH, HEIGHT, "floyd-steinberg"));

		assert.ok(Math.abs(share - 0.5) < 0.01, `${share} black`);
	});

	test("the threshold cuts at 50%", () => {
		const gray = Float32Array.from([0, 100, 127, 127.9, 128, 200, 255]);

		assert.deepEqual([...dither(gray, 7, 1, "threshold")], [0, 0, 0, 0, 255, 255, 255]);
		assert.equal(blackShare(dither(flat(127), WIDTH, HEIGHT, "threshold")), 1);
		assert.equal(blackShare(dither(flat(128), WIDTH, HEIGHT, "threshold")), 0);
	});

	test("an unknown method is a bug", () => {
		assert.throws(() => dither(flat(0), WIDTH, HEIGHT, "ordered"), /Unknown dithering method/);
	});
});

describe("brightness and contrast", () => {
	test("change nothing at 0", () => {
		assert.deepEqual(adjust(ramp(), { brightness: 0, contrast: 0 }), ramp());
	});

	test("brightness 100 makes everything white, -100 everything black", () => {
		for (const method of METHODS) {
			assert.equal(blackShare(render(ramp(), WIDTH, HEIGHT, { brightness: 100, contrast: 0, method })), 0);
			assert.equal(blackShare(render(ramp(), WIDTH, HEIGHT, { brightness: -100, contrast: 0, method })), 1);
		}
	});

	test("contrast -100 makes everything the middle gray", () => {
		const adjusted = adjust(ramp(), { contrast: -100 });

		assert.ok(adjusted.every((value) => value === 128));
	});

	test("contrast 100 is nearly a threshold", () => {
		const adjusted = adjust(Float32Array.from([0, 120, 127, 129, 136, 255]), { contrast: 100 });

		assert.deepEqual([...adjusted], [0, 0, 0, 255, 255, 255]);
	});

	test("stay between 0 and 255", () => {
		const adjusted = adjust(ramp(), { brightness: 60, contrast: 80 });

		assert.ok(adjusted.every((value) => value >= 0 && value <= 255));
	});
});

describe("pixels", () => {
	test("a canvas's RGBA becomes luma, on white where it's see-through", () => {
		const rgba = Uint8ClampedArray.from([255, 255, 255, 255, 0, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0]);

		const gray = grayscale(rgba);

		assert.equal(gray[0], 255);
		assert.equal(gray[1], 0);
		assert.ok(Math.abs(gray[2] - 76.245) < 1e-3, "red is dark");
		assert.equal(gray[3], 255, "a transparent pixel is white");
	});

	test("go back to the canvas as opaque RGBA, exactly 0 or 255", () => {
		assert.deepEqual([...toRgba(Uint8Array.from([0, 255]))], [0, 0, 0, 255, 255, 255, 255, 255]);
	});
});
