// The editor's view (D48), with no DOM: zoom, and from the screen to frame pixels. A zoom is how many
// screen (device) pixels show one frame pixel.
import { FRAME_HEIGHT, FRAME_WIDTH } from "./crop.js";

/** The zooms besides Fit; 1 is "actual pixels", one frame pixel on one screen pixel. */
export const ZOOMS = [1, 2, 4, 8, 16];

/** A step changes the zoom by at least this much, so a Fit close to a zoom isn't a step of its own. */
const MIN_STEP = 1.25;

/** The zoom at which the whole frame fits in an area of this size, in CSS pixels. */
export function fitZoom(width, height, devicePixelRatio) {
	return Math.min(width / FRAME_WIDTH, height / FRAME_HEIGHT) * devicePixelRatio;
}

/** The canvas's width in CSS pixels at a zoom. */
export function cssWidth(zoom, devicePixelRatio) {
	return (FRAME_WIDTH * zoom) / devicePixelRatio;
}

/**
 * The next zoom in (direction 1) or out (−1) from `current`, among ZOOMS and Fit's zoom, skipping those within
 * MIN_STEP of it. At either end it stays.
 */
export function stepZoom(current, fit, direction) {
	const zooms = [...ZOOMS, fit].sort((a, b) => a - b);
	if (direction > 0) {
		return zooms.find((zoom) => zoom >= current * MIN_STEP) ?? current;
	}
	return zooms.findLast((zoom) => zoom <= current / MIN_STEP) ?? current;
}

/**
 * The frame pixel under a point of the screen, with `box` the canvas's place on the screen (a DOMRect). Whole
 * pixels, and possibly outside the frame.
 */
export function framePoint(clientX, clientY, box) {
	return {
		x: Math.floor(((clientX - box.left) * FRAME_WIDTH) / box.width),
		y: Math.floor(((clientY - box.top) * FRAME_HEIGHT) / box.height),
	};
}

/**
 * How far to scroll, on one axis, so the point of the canvas that was at `client` is there again after the
 * canvas went from `before` to `after`, each its `{ start, size }` on the screen on that axis.
 */
export function scrollToKeep(client, before, after) {
	const fraction = (client - before.start) / before.size;
	return after.start + fraction * after.size - client;
}
