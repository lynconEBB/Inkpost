import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	composite,
	drawingLayer,
	findLayer,
	insertAbove,
	moveLayer,
	photoLayer,
	removeLayer,
	textLayer,
	textLayerAt,
	updateLayer,
} from "../../main/resources/static/js/layers.js";
import { BLACK, stamp, WHITE } from "../../main/resources/static/js/raster.js";

const WIDTH = 800;
const HEIGHT = 480;

const ids = (layers) => layers.map((layer) => layer.id);
const at = (frame, x, y) => frame[y * WIDTH + x];
const noPhotos = () => assert.fail("no photo expected");

/** A photo part of one gray value. */
function part(left, top, width, height, value) {
	return { left, top, width, height, values: new Float32Array(width * height).fill(value) };
}

function list() {
	return [drawingLayer(1, "Layer 1"), drawingLayer(2, "Layer 2"), drawingLayer(3, "Layer 3")];
}

describe("a new layer", () => {
	test("for drawing is visible and clear", () => {
		const layer = drawingLayer(7, "Layer 7");

		assert.equal(layer.kind, "drawing");
		assert.equal(layer.visible, true);
		assert.equal(layer.pixels.length, WIDTH * HEIGHT);
		assert.ok(layer.pixels.every((value) => value === 0));
	});

	test("for a photo shows all of it, covers the frame, centered, with the default adjustments", () => {
		const source = { width: 4032, height: 3024 };
		const layer = photoLayer(8, "Beach", source);

		assert.equal(layer.source, source);
		assert.deepEqual(layer.crop, { left: 0, top: 0, width: 4032, height: 3024 });
		assert.deepEqual(
			{ scale: layer.scale, centerX: layer.centerX, centerY: layer.centerY },
			{ scale: 1, centerX: 400, centerY: 240 },
		);
		assert.deepEqual(
			{ brightness: layer.brightness, contrast: layer.contrast, method: layer.method },
			{ brightness: 0, contrast: 0, method: "floyd-steinberg" },
		);
	});
});

describe("the list", () => {
	test("inserts a layer just above another one", () => {
		const layers = list();

		assert.deepEqual(ids(insertAbove(layers, 1, drawingLayer(4, "Layer 4"))), [1, 4, 2, 3]);
		assert.deepEqual(ids(insertAbove(layers, 3, drawingLayer(4, "Layer 4"))), [1, 2, 3, 4]);
		assert.deepEqual(ids(insertAbove(layers, null, drawingLayer(4, "Layer 4"))), [1, 2, 3, 4]);
		assert.deepEqual(ids(insertAbove([], null, drawingLayer(4, "Layer 4"))), [4]);
	});

	test("removes a layer", () => {
		assert.deepEqual(ids(removeLayer(list(), 2)), [1, 3]);
	});

	test("moves a layer up and down, and not past the ends", () => {
		const layers = list();

		assert.deepEqual(ids(moveLayer(layers, 1, 1)), [2, 1, 3]);
		assert.deepEqual(ids(moveLayer(layers, 2, -1)), [2, 1, 3]);
		assert.equal(moveLayer(layers, 3, 1), layers);
		assert.equal(moveLayer(layers, 1, -1), layers);
	});

	test("updates a copy of one layer", () => {
		const layers = list();
		const updated = updateLayer(layers, 2, { name: "Sky", visible: false });

		assert.equal(findLayer(updated, 2).name, "Sky");
		assert.equal(findLayer(updated, 2).visible, false);
		assert.equal(findLayer(layers, 2).name, "Layer 2", "the old list is untouched");
		assert.equal(updated[0], layers[0], "the other layers are the same objects");
	});

	test("finds nothing for an unknown id", () => {
		assert.equal(findLayer(list(), 9), null);
	});
});

describe("the composite", () => {
	test("is white with no layers", () => {
		const frame = composite([], { photo: noPhotos });

		assert.equal(frame.length, WIDTH * HEIGHT);
		assert.ok(frame.every((value) => value === 255));
	});

	test("draws a drawing's black and white, and shows what's below through its clear pixels", () => {
		const below = drawingLayer(1, "Below");
		stamp(below.pixels, 0, 0, 2, BLACK);
		const above = drawingLayer(2, "Above");
		stamp(above.pixels, 1, 1, 2, WHITE);
		const frame = composite([below, above], { photo: noPhotos });

		assert.equal(at(frame, 0, 0), 0);
		assert.equal(at(frame, 1, 0), 0);
		assert.equal(at(frame, 1, 1), 255, "white over black");
		assert.equal(at(frame, 5, 5), 255);
	});

	test("goes from the bottom up", () => {
		const black = drawingLayer(1, "Black");
		black.pixels.fill(BLACK);
		const white = drawingLayer(2, "White");
		white.pixels.fill(WHITE);

		assert.equal(at(composite([black, white], { photo: noPhotos }), 9, 9), 255);
		assert.equal(at(composite([white, black], { photo: noPhotos }), 9, 9), 0);
	});

	test("leaves out hidden layers", () => {
		const black = { ...drawingLayer(1, "Black"), visible: false };
		black.pixels.fill(BLACK);

		assert.ok(composite([black], { photo: noPhotos }).every((value) => value === 255));
	});

	test("covers the frame with a photo's part, whatever its pixels, and draws over it", () => {
		const photo = photoLayer(1, "Photo", { width: 1600, height: 960 });
		const drawing = drawingLayer(2, "Drawing");
		stamp(drawing.pixels, 12, 12, 1, WHITE);
		const frame = composite([photo, drawing], {
			photo: (layer) => {
				assert.equal(layer, photo);
				return part(10, 10, 5, 4, 0);
			},
		});

		assert.equal(at(frame, 10, 10), 0);
		assert.equal(at(frame, 14, 13), 0);
		assert.equal(at(frame, 12, 12), 255);
		assert.equal(at(frame, 15, 10), 255, "right of the part");
		assert.equal(at(frame, 10, 14), 255, "below the part");
		assert.equal(frame.filter((value) => value === 0).length, 19);
	});

	test("covers what's below with a photo, and keeps a photo's grays while it's moved", () => {
		const drawing = drawingLayer(1, "Drawing");
		drawing.pixels.fill(BLACK);
		const photo = photoLayer(2, "Photo", { width: 1600, height: 960 });
		const frame = composite([drawing, photo], { photo: () => part(0, 0, WIDTH, HEIGHT, 100.4) });

		assert.ok(frame.every((value) => value === 100));
	});

	test("leaves out a photo outside the frame", () => {
		const photo = photoLayer(1, "Photo", { width: 1600, height: 960 });

		assert.ok(composite([photo], { photo: () => null }).every((value) => value === 255));
	});

	test("paints a text's color where its mask is, over what's below", () => {
		const black = drawingLayer(1, "Black");
		black.pixels.fill(BLACK);
		const box = { left: 10, top: 20, width: 4, height: 2 };
		const white = textLayer(2, "Text", box, { size: 40, align: "left", color: WHITE });
		const mask = Uint8Array.from([1, 0, 0, 1, 0, 1, 1, 0]);
		const frame = composite([black, white], { photo: noPhotos, text: () => mask });

		assert.deepEqual([at(frame, 10, 20), at(frame, 11, 20), at(frame, 12, 20), at(frame, 13, 20)], [255, 0, 0, 255]);
		assert.deepEqual([at(frame, 10, 21), at(frame, 11, 21), at(frame, 12, 21), at(frame, 13, 21)], [0, 255, 255, 0]);
		assert.equal(frame.filter((value) => value === 255).length, 4);
	});

	test("cuts a text at the frame's edges", () => {
		const box = { left: -2, top: 478, width: 4, height: 4 };
		const layer = textLayer(1, "Text", box, { size: 24, align: "left", color: BLACK });
		const frame = composite([layer], { photo: noPhotos, text: () => new Uint8Array(16).fill(1) });

		assert.equal(frame.filter((value) => value === 0).length, 4);
		assert.equal(at(frame, 0, 478), 0);
		assert.equal(at(frame, 1, 479), 0);
		assert.equal(at(frame, 2, 478), 255);
	});

	test("leaves out a hidden text", () => {
		const layer = { ...textLayer(1, "Text", { left: 0, top: 0, width: 2, height: 2 }, { color: BLACK }), visible: false };

		assert.ok(composite([layer], { photo: noPhotos, text: () => assert.fail() }).every((value) => value === 255));
	});
});

describe("a text layer", () => {
	const box = { left: 100, top: 50, width: 200, height: 80 };

	test("starts empty, in its box, with its size, alignment and color", () => {
		const layer = textLayer(3, "Text 1", box, { size: 64, align: "center", color: WHITE });

		assert.deepEqual(
			{ ...layer },
			{ id: 3, kind: "text", name: "Text 1", visible: true, text: "", size: 64, align: "center", color: WHITE, ...box },
		);
	});

	test("is found under a point, the top one first, and not when hidden", () => {
		const below = textLayer(1, "Below", box, { size: 24, align: "left", color: BLACK });
		const above = textLayer(2, "Above", { ...box, left: 250 }, { size: 24, align: "left", color: BLACK });
		const drawing = drawingLayer(3, "Drawing");
		const layers = [below, above, drawing];

		assert.equal(textLayerAt(layers, { x: 120, y: 60 }), below);
		assert.equal(textLayerAt(layers, { x: 260, y: 60 }), above);
		assert.equal(textLayerAt(layers, { x: 10, y: 10 }), null);
		assert.equal(textLayerAt(updateLayer(layers, 2, { visible: false }), { x: 260, y: 60 }), below);
	});
});
