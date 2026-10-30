// The editor's layers (D47), with no DOM. The list runs from the bottom up, on a white background. A drawing
// layer is pixels (raster.js); a photo layer is a photo with its place, size, crop (D58) and adjustments,
// which the page draws and dithers; a text layer is a text in a box (D50), which the page draws in the font.
// Lists and layers are never changed in place, so the undo history keeps them (D49).
import { FRAME_HEIGHT, FRAME_WIDTH, wholePhoto } from "./crop.js";
import { DEFAULT_SETTINGS } from "./dither.js";
import { BLACK, blank, WHITE } from "./raster.js";
import { inBox } from "./text.js";

const WHITE_VALUE = 255;

export function drawingLayer(id, name) {
	return { id, kind: "drawing", name, visible: true, pixels: blank() };
}

/** A photo (anything with a width and a height, e.g. an ImageBitmap), whole, covering the frame, centered. */
export function photoLayer(id, name, source) {
	return {
		id,
		kind: "photo",
		name,
		visible: true,
		source,
		crop: wholePhoto(source.width, source.height),
		scale: 1,
		centerX: FRAME_WIDTH / 2,
		centerY: FRAME_HEIGHT / 2,
		...DEFAULT_SETTINGS,
	};
}

/** An empty text in a box, `{ left, top, width, height }`, with its size (TEXT_SIZES), alignment and color. */
export function textLayer(id, name, box, { size, align, color }) {
	return { id, kind: "text", name, visible: true, text: "", size, align, color, ...box };
}

/** The top visible text layer whose box has the point, or null. */
export function textLayerAt(layers, point) {
	return layers.findLast((layer) => layer.kind === "text" && layer.visible && inBox(layer, point)) ?? null;
}

export function findLayer(layers, id) {
	return layers.find((layer) => layer.id === id) ?? null;
}

/** The list with `layer` just above the layer `belowId`, or on top if there is no such layer. */
export function insertAbove(layers, belowId, layer) {
	const index = layers.findIndex((each) => each.id === belowId);
	return index === -1 ? [...layers, layer] : layers.toSpliced(index + 1, 0, layer);
}

export function removeLayer(layers, id) {
	return layers.filter((layer) => layer.id !== id);
}

/** The list with the layer one place up (step 1) or down (−1); a layer already at that end stays. */
export function moveLayer(layers, id, step) {
	const index = layers.findIndex((layer) => layer.id === id);
	const to = index + step;
	if (index === -1 || to < 0 || to >= layers.length) {
		return layers;
	}
	const moved = [...layers];
	[moved[index], moved[to]] = [moved[to], moved[index]];
	return moved;
}

/** The list with the layer `id` replaced by a copy with `changes`. */
export function updateLayer(layers, id, changes) {
	return layers.map((layer) => (layer.id === id ? { ...layer, ...changes } : layer));
}

/**
 * The frame as gray values from 0 (black) to 255 (white): white, then every visible layer from the bottom
 * up. A drawing's clear pixels let what's below show through. A photo covers the part of the frame it's on
 * with `photo(layer)`: `{ left, top, width, height, values }`, its gray values there, or null. A text paints
 * its color where `text(layer)`, a mask of its box (1 for the text, 0 around it), is 1; its box can go past
 * the frame's edges.
 */
export function composite(layers, { photo, text }) {
	const frame = new Uint8ClampedArray(FRAME_WIDTH * FRAME_HEIGHT).fill(WHITE_VALUE);
	for (const layer of layers) {
		if (!layer.visible) {
			continue;
		}
		if (layer.kind === "drawing") {
			const { pixels } = layer;
			for (let i = 0; i < pixels.length; i++) {
				if (pixels[i] === BLACK) {
					frame[i] = 0;
				} else if (pixels[i] === WHITE) {
					frame[i] = WHITE_VALUE;
				}
			}
			continue;
		}
		if (layer.kind === "text") {
			paintMask(frame, layer, text(layer), layer.color === BLACK ? 0 : WHITE_VALUE);
			continue;
		}
		const part = photo(layer);
		if (!part) {
			continue;
		}
		for (let row = 0; row < part.height; row++) {
			const from = row * part.width;
			frame.set(part.values.subarray(from, from + part.width), (part.top + row) * FRAME_WIDTH + part.left);
		}
	}
	return frame;
}

/** `value` where the mask of the box is 1, inside the frame. */
function paintMask(frame, box, mask, value) {
	const left = Math.max(0, box.left);
	const right = Math.min(FRAME_WIDTH, box.left + box.width);
	for (let y = Math.max(0, box.top); y < Math.min(FRAME_HEIGHT, box.top + box.height); y++) {
		const row = (y - box.top) * box.width - box.left;
		for (let x = left; x < right; x++) {
			if (mask[row + x] === 1) {
				frame[y * FRAME_WIDTH + x] = value;
			}
		}
	}
}
