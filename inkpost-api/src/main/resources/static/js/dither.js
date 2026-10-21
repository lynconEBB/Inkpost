// A photo to black and white pixels (D44), with no DOM. It works on plain arrays of width × height
// pixels, so the editor's photo import can reuse it (D21).
//
// Gray values run from 0 (black) to 255 (white). The result is 0 or 255 per pixel, nothing else.

export const DEFAULT_SETTINGS = Object.freeze({ brightness: 0, contrast: 0, method: "floyd-steinberg" });

/** From here up is white. */
const MIDDLE = 128;

/** The luma (Rec. 601) of RGBA pixels, as a canvas gives them. A see-through pixel is on white. */
export function grayscale(rgba) {
	const gray = new Float32Array(rgba.length / 4);
	for (let i = 0; i < gray.length; i++) {
		const alpha = rgba[i * 4 + 3] / 255;
		const luma = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
		gray[i] = luma * alpha + 255 * (1 - alpha);
	}
	return gray;
}

/**
 * Brightness and contrast, each −100 … 100, 0 changing nothing. Contrast scales around the middle gray:
 * −100 makes every pixel the middle gray, 100 is nearly a threshold. Brightness then shifts every pixel:
 * 100 makes them all white, −100 all black.
 */
export function adjust(gray, { brightness = 0, contrast = 0 } = {}) {
	const c = contrast * 2.55;
	const factor = (259 * (c + 255)) / (255 * (259 - c));
	const shift = brightness * 2.55;
	const adjusted = new Float32Array(gray.length);
	for (let i = 0; i < gray.length; i++) {
		adjusted[i] = Math.min(255, Math.max(0, factor * (gray[i] - MIDDLE) + MIDDLE + shift));
	}
	return adjusted;
}

/** "floyd-steinberg" (the default), "atkinson" or "threshold". */
export function dither(gray, width, height, method = DEFAULT_SETTINGS.method) {
	switch (method) {
		case "floyd-steinberg":
			return floydSteinberg(gray, width, height);
		case "atkinson":
			return atkinson(gray, width, height);
		case "threshold":
			return threshold(gray);
		default:
			throw new Error(`Unknown dithering method "${method}"`);
	}
}

/** Adjusts, then dithers. */
export function render(gray, width, height, settings = DEFAULT_SETTINGS) {
	return dither(adjust(gray, settings), width, height, settings.method);
}

/** Gray or black and white values as opaque RGBA, for a canvas: each value in R, G and B, alpha 255. */
export function toRgba(values) {
	const rgba = new Uint8ClampedArray(values.length * 4);
	for (let i = 0; i < values.length; i++) {
		rgba[i * 4] = values[i];
		rgba[i * 4 + 1] = values[i];
		rgba[i * 4 + 2] = values[i];
		rgba[i * 4 + 3] = 255;
	}
	return rgba;
}

function quantize(value) {
	return value < MIDDLE ? 0 : 255;
}

function threshold(gray) {
	const result = new Uint8Array(gray.length);
	for (let i = 0; i < gray.length; i++) {
		result[i] = quantize(gray[i]);
	}
	return result;
}

/**
 * Each pixel's error goes to its unvisited neighbours (7/16 ahead, 3/16, 5/16 and 1/16 below). The scan is
 * serpentine: every other row runs right to left, so the error doesn't drift into diagonal streaks.
 */
function floydSteinberg(gray, width, height) {
	const values = Float32Array.from(gray);
	const result = new Uint8Array(gray.length);
	for (let y = 0; y < height; y++) {
		const ahead = y % 2 === 0 ? 1 : -1;
		for (let i = 0; i < width; i++) {
			const x = ahead === 1 ? i : width - 1 - i;
			const index = y * width + x;
			result[index] = quantize(values[index]);
			const error = values[index] - result[index];
			spread(values, width, height, x + ahead, y, (error * 7) / 16);
			spread(values, width, height, x - ahead, y + 1, (error * 3) / 16);
			spread(values, width, height, x, y + 1, (error * 5) / 16);
			spread(values, width, height, x + ahead, y + 1, error / 16);
		}
	}
	return result;
}

/** 1/8 of the error to each of 6 neighbours, so a quarter is dropped: lighter, with more contrast. */
function atkinson(gray, width, height) {
	const values = Float32Array.from(gray);
	const result = new Uint8Array(gray.length);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = y * width + x;
			result[index] = quantize(values[index]);
			const share = (values[index] - result[index]) / 8;
			spread(values, width, height, x + 1, y, share);
			spread(values, width, height, x + 2, y, share);
			spread(values, width, height, x - 1, y + 1, share);
			spread(values, width, height, x, y + 1, share);
			spread(values, width, height, x + 1, y + 1, share);
			spread(values, width, height, x, y + 2, share);
		}
	}
	return result;
}

function spread(values, width, height, x, y, amount) {
	if (x >= 0 && x < width && y < height) {
		values[y * width + x] += amount;
	}
}
