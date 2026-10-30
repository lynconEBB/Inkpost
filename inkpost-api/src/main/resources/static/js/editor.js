// The frame editor (D47–D50): drawings, photos and texts in layers, flattened into the 800×480 black and
// white PNG the API takes (D41), all in the browser (D19, D44), then sent to POST /api/frames.
import { api } from "./api.js";
import {
	cropCoverScale,
	cropPhoto,
	FRAME_HEIGHT,
	FRAME_WIDTH,
	fitScale,
	photoRect,
	visiblePart,
	wholePhoto,
} from "./crop.js";
import { adjust, DEFAULT_SETTINGS, grayscale, render, toRgba } from "./dither.js";
import { History } from "./history.js";
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
} from "./layers.js";
import { BLACK, cellLine, cellOf, CLEAR, ellipse, floodFill, line, rectangle, shift, WHITE } from "./raster.js";
import { boxBetween, lineX, MIN_BOX, resizeBox, TEXT_SIZES, wrap } from "./text.js";
import { busy, clearFieldErrors, clone, showError, showFieldErrors, showFormError } from "./ui.js";
import { cssWidth, fitZoom, framePoint, scrollToKeep, stepZoom } from "./viewport.js";

const NAME_LENGTH = 100;
const TOOL_KEYS = {
	v: "move",
	h: "hand",
	b: "pencil",
	p: "pixel",
	e: "eraser",
	l: "line",
	r: "rectangle",
	o: "ellipse",
	g: "bucket",
	t: "text",
};
const TOOL_HINTS = {
	move: "Drag the layer, or use the arrow keys (Shift: 10 pixels). A photo's handles crop it.",
	hand: "Drag to scroll the view. Space or the middle button scrolls with any tool.",
	pencil: "Draw in the color.",
	pixel: "Fill whole cells of the grid in the color.",
	eraser: "Erase to see-through: the layers below show.",
	line: "Drag from one end to the other.",
	rectangle: "Drag from one corner to the other. The border is in the color.",
	ellipse: "Drag from one corner to the other. The border is in the color.",
	bucket: "Fill an area of the same color on this layer.",
	text: "Drag a box, then type in the layer's settings. Click a text to change it.",
};
const KIND_NAMES = { drawing: "Drawing", photo: "Photo", text: "Text" };
const FILLS = { none: null, black: BLACK, white: WHITE };
const KEY_MOVES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
/** Shift + an arrow key moves this many pixels. */
const BIG_STEP = 10;
/** Ctrl + wheel: how much scrolling is one zoom step. A mouse notch is about 100, a pinch sends less. */
const WHEEL_STEP = 50;
/** The Pixel tool's grid is hidden while its cells are smaller than this on the screen, in CSS pixels. */
const MIN_GRID_CELL = 4;
/** The text font (app.css), and its lines: their height and their baseline, as parts of the size (D22). */
const TEXT_FONT = '700 SIZEpx "Inkpost Text"';
const LINE_HEIGHT = 1.3;
const BASELINE = 1;
/** A click with the Text tool makes a box this wide, and two lines high. */
const CLICK_BOX_WIDTH = 320;

const form = document.getElementById("editor-form");
const area = document.getElementById("area");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const bounds = document.getElementById("bounds");
const grid = document.getElementById("grid");
const toolButtons = document.querySelectorAll("[data-tool]");
const toolOptions = document.querySelectorAll("[data-tools]");
const colorButton = document.getElementById("color");
const brush = document.getElementById("brush");
const cellSize = document.getElementById("cell");
const border = document.getElementById("border");
const fill = document.getElementById("fill");
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");
const zoomValue = document.getElementById("zoom-value");
const layerList = document.getElementById("layer-list");
const layerUp = document.getElementById("layer-up");
const layerDown = document.getElementById("layer-down");
const layerDelete = document.getElementById("layer-delete");
const photoInput = document.getElementById("photo");
const layerName = document.getElementById("layer-name");
const photoSettings = document.getElementById("photo-settings");
const size = document.getElementById("size");
const brightness = document.getElementById("brightness");
const contrast = document.getElementById("contrast");
const method = document.getElementById("method");
const textSettings = document.getElementById("text-settings");
const textInput = document.getElementById("text");
const textSize = document.getElementById("text-size");
const textAlign = document.getElementById("text-align");
const textColor = document.getElementById("text-color");
const nameInput = document.getElementById("name");
const saveButton = document.getElementById("save");

// Photos are cropped here, and read back as pixels.
const crop = document.createElement("canvas");
crop.width = FRAME_WIDTH;
crop.height = FRAME_HEIGHT;
const cropContext = crop.getContext("2d", { willReadFrequently: true });
// Texts are drawn here in the font, and read back as a mask.
const lettering = document.createElement("canvas");
const letteringContext = lettering.getContext("2d", { willReadFrequently: true });

const steps = new History([drawingLayer(1, "Layer 1")]);
/** What's shown: the history's current list, or a change to it that isn't a step yet (a stroke, a slider). */
let layers = steps.current;
let activeId = 1;
let nextId = 2;
let drawingCount = 1;
let textCount = 0;
let tool = "pencil";
let color = BLACK;
/** The pointer drag under way: { kind: "pan" | "draw" | "move", pointerId, … }, or null. */
let gesture = null;
let spaceDown = false;
/** Screen pixels per frame pixel, or null for Fit. */
let zoom = null;
let wheel = 0;
/** The photo being moved or resized: shown in gray, and dithered once it's let go (D44). */
let roughPhotoId = null;
/** Per photo layer: its crop's grayscale, and the dithered pixels, kept until they change. */
const photoCache = new Map();
/** Per text layer: its mask, and whether lines were left out, kept until they change. */
const textCache = new Map();
/** A new text box takes the size and alignment last chosen. */
const textStyle = { size: TEXT_SIZES.medium, align: "left" };
let defaultName = "";
let saved = false;
let frameRequested = false;

for (const button of toolButtons) {
	button.addEventListener("click", () => setTool(button.dataset.tool));
}
colorButton.addEventListener("click", switchColor);
cellSize.addEventListener("change", showGrid);
undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);
document.getElementById("zoom-in").addEventListener("click", () => zoomStep(1));
document.getElementById("zoom-out").addEventListener("click", () => zoomStep(-1));
document.getElementById("zoom-fit").addEventListener("click", () => zoomTo(null));
document.getElementById("zoom-actual").addEventListener("click", () => zoomTo(1));
document.getElementById("new-layer").addEventListener("click", newLayer);
photoInput.addEventListener("change", addPhoto);
layerUp.addEventListener("click", () => commit(moveLayer(steps.current, activeId, 1)));
layerDown.addEventListener("click", () => commit(moveLayer(steps.current, activeId, -1)));
layerDelete.addEventListener("click", deleteLayer);
layerName.addEventListener("change", rename);
layerName.addEventListener("keydown", (event) => {
	// Enter keeps the name instead of saving the frame.
	if (event.key === "Enter") {
		event.preventDefault();
		layerName.blur();
	}
});

// The sliders show while they move, and are one step in the history once let go.
size.addEventListener("input", () => {
	roughPhotoId = activeId;
	preview({ scale: Number(size.value) / 100 });
	document.getElementById("size-value").textContent = `${size.value}%`;
});
for (const slider of [brightness, contrast]) {
	slider.addEventListener("input", () => {
		preview({ [slider.id]: Number(slider.value) });
		document.getElementById(`${slider.id}-value`).textContent = slider.value;
	});
}
for (const slider of [size, brightness, contrast]) {
	slider.addEventListener("change", () => {
		roughPhotoId = null;
		commit(layers);
	});
}
method.addEventListener("change", () => commit(updateLayer(steps.current, activeId, { method: method.value })));
document.getElementById("reset").addEventListener("click", () => {
	commit(updateLayer(steps.current, activeId, DEFAULT_SETTINGS));
});
// Typing shows at once, and is one step in the history once the text field is left.
textInput.addEventListener("input", () => preview({ text: textInput.value }));
textInput.addEventListener("change", () => commit(layers));
textSize.addEventListener("change", () => {
	textStyle.size = TEXT_SIZES[textSize.value];
	commit(updateLayer(steps.current, activeId, { size: textStyle.size }));
});
textAlign.addEventListener("change", () => {
	textStyle.align = textAlign.value;
	commit(updateLayer(steps.current, activeId, { align: textStyle.align }));
});
textColor.addEventListener("change", () => {
	commit(updateLayer(steps.current, activeId, { color: textColor.value === "white" ? WHITE : BLACK }));
});
document.getElementById("cover").addEventListener("click", () => {
	placePhoto(({ source, crop }) => ({ scale: cropCoverScale(source.width, source.height, crop) }));
});
document.getElementById("whole-photo").addEventListener("click", () => {
	placePhoto(({ source }) => ({
		crop: wholePhoto(source.width, source.height),
		scale: fitScale(source.width, source.height),
	}));
});

area.addEventListener("pointerdown", startGesture);
area.addEventListener("pointermove", continueGesture);
area.addEventListener("pointerup", endGesture);
area.addEventListener("pointercancel", cancelGesture);
// The middle button scrolls like the Hand, not with the browser's autoscroll.
area.addEventListener("mousedown", (event) => {
	if (event.button === 1) {
		event.preventDefault();
	}
});
area.addEventListener("wheel", zoomWithWheel, { passive: false });
canvas.addEventListener("keydown", moveWithKeys);
document.addEventListener("keydown", shortcut);
document.addEventListener("keyup", (event) => {
	if (event.key === " ") {
		spaceDown = false;
		updateCursor();
	}
});
addEventListener("blur", () => {
	spaceDown = false;
	updateCursor();
});
new ResizeObserver(() => {
	if (zoom === null) {
		applyZoom();
	}
}).observe(area);

form.addEventListener("submit", (event) => {
	event.preventDefault();
	busy(saveButton, save);
});
// The layers are kept nowhere else (D47).
addEventListener("beforeunload", (event) => {
	if (steps.canUndo && !saved) {
		event.preventDefault();
	}
});

setTool(tool);
applyZoom();
refresh();
// Texts drawn before the font arrived are drawn again.
document.fonts.load(TEXT_FONT.replace("SIZE", TEXT_SIZES.medium)).then(() => {
	textCache.clear();
	redraw();
});

// ---------- History ----------

/** A step in the history, then everything shown follows it. */
function commit(next) {
	if (next !== steps.current) {
		steps.push(next);
	}
	layers = steps.current;
	refresh();
}

function undo() {
	if (!gesture) {
		layers = steps.undo();
		refresh();
	}
}

function redo() {
	if (!gesture) {
		layers = steps.redo();
		refresh();
	}
}

/** A change shown but not yet a step, from the history's current list. */
function preview(changes) {
	layers = updateLayer(steps.current, activeId, changes);
	redraw();
}

function refresh() {
	if (!findLayer(layers, activeId)) {
		activeId = layers.at(-1)?.id ?? null;
	}
	for (const cache of [photoCache, textCache]) {
		for (const id of cache.keys()) {
			if (!findLayer(layers, id)) {
				cache.delete(id);
			}
		}
	}
	undoButton.disabled = !steps.canUndo;
	redoButton.disabled = !steps.canRedo;
	const index = layers.findIndex((layer) => layer.id === activeId);
	layerUp.disabled = index === -1 || index === layers.length - 1;
	layerDown.disabled = index <= 0;
	layerDelete.disabled = index === -1;
	renderLayerList();
	renderSettings();
	redraw();
}

// ---------- Layers ----------

function renderLayerList() {
	// The list is built again, so the focus goes back to the same button of the same layer.
	const focused = layerList.contains(document.activeElement) ? document.activeElement : null;
	const keep = focused && { id: focused.closest(".layer").dataset.layerId, part: focused.dataset.part };
	layerList.replaceChildren(...layers.toReversed().map(layerRow));
	if (keep) {
		layerList.querySelector(`[data-layer-id="${keep.id}"] [data-part="${keep.part}"]`)?.focus();
	}
}

function layerRow(layer) {
	const row = clone("layer-row");
	row.dataset.layerId = layer.id;
	const select = row.querySelector(".layer__select");
	select.querySelector(".layer__name").textContent = layer.name;
	select.querySelector(".layer__kind").textContent = KIND_NAMES[layer.kind];
	if (layer.id === activeId) {
		select.setAttribute("aria-current", "true");
	}
	select.addEventListener("click", () => selectLayer(layer.id));
	const visible = row.querySelector(".layer__visible");
	visible.setAttribute("aria-pressed", String(layer.visible));
	visible.setAttribute("aria-label", `Show ${layer.name}`);
	visible.addEventListener("click", () => {
		commit(updateLayer(steps.current, layer.id, { visible: !findLayer(steps.current, layer.id).visible }));
	});
	return row;
}

function selectLayer(id) {
	activeId = id;
	refresh();
}

function renderSettings() {
	const layer = findLayer(layers, activeId);
	document.getElementById("no-layer").hidden = layer !== null;
	document.getElementById("layer-name-field").hidden = layer === null;
	photoSettings.hidden = layer?.kind !== "photo";
	textSettings.hidden = layer?.kind !== "text";
	if (!layer) {
		return;
	}
	layerName.value = layer.name;
	if (layer.kind === "photo") {
		size.value = Math.round(layer.scale * 100);
		brightness.value = layer.brightness;
		contrast.value = layer.contrast;
		method.value = layer.method;
		document.getElementById("size-value").textContent = `${size.value}%`;
		document.getElementById("brightness-value").textContent = brightness.value;
		document.getElementById("contrast-value").textContent = contrast.value;
	}
	if (layer.kind === "text") {
		// Only when it changed, so the caret stays where it is.
		if (textInput.value !== layer.text) {
			textInput.value = layer.text;
		}
		textSize.value = Object.keys(TEXT_SIZES).find((name) => TEXT_SIZES[name] === layer.size);
		textAlign.value = layer.align;
		textColor.value = layer.color === WHITE ? "white" : "black";
	}
}

function newLayer() {
	const layer = drawingLayer(nextId++, `Layer ${++drawingCount}`);
	const next = insertAbove(steps.current, activeId, layer);
	activeId = layer.id;
	commit(next);
}

async function addPhoto() {
	const file = photoInput.files[0];
	// The same file can be added again.
	photoInput.value = "";
	if (!file) {
		return;
	}
	let source;
	try {
		source = await decode(file);
	} catch {
		showError("Can't read this image, use a JPEG or PNG.");
		return;
	}
	const name = file.name.replace(/\.[^.]*$/, "").trim().slice(0, NAME_LENGTH) || "Photo";
	const layer = photoLayer(nextId++, name, source);
	const next = insertAbove(steps.current, activeId, layer);
	activeId = layer.id;
	// The frame's name follows the photo, unless it was typed.
	if (nameInput.value === defaultName) {
		nameInput.value = name;
	}
	defaultName = name;
	setTool("move");
	commit(next);
}

/** Upright, whatever the camera's EXIF orientation. Some browsers can't decode some files (e.g. HEIC). */
async function decode(file) {
	try {
		return await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch (error) {
		// A browser that doesn't know the option yet applies the orientation by itself.
		if (error instanceof TypeError) {
			return createImageBitmap(file);
		}
		throw error;
	}
}

/** The layer below takes its place, or the new bottom one. */
function deleteLayer() {
	const index = steps.current.findIndex((layer) => layer.id === activeId);
	const next = removeLayer(steps.current, activeId);
	activeId = (next[index - 1] ?? next[0])?.id ?? null;
	commit(next);
}

function rename() {
	const layer = findLayer(steps.current, activeId);
	const name = layerName.value.trim().slice(0, NAME_LENGTH);
	if (!layer || name === "" || name === layer.name) {
		layerName.value = layer?.name ?? "";
		return;
	}
	commit(updateLayer(steps.current, activeId, { name }));
}

/** The active photo with `changesOf(layer)` (a scale, a crop), centered. */
function placePhoto(changesOf) {
	const layer = findLayer(steps.current, activeId);
	commit(
		updateLayer(steps.current, activeId, {
			...changesOf(layer),
			centerX: FRAME_WIDTH / 2,
			centerY: FRAME_HEIGHT / 2,
		}),
	);
}

// ---------- Drawing the frame ----------

/** At most once per frame. */
function redraw() {
	if (!frameRequested) {
		frameRequested = true;
		requestAnimationFrame(draw);
	}
}

function draw() {
	frameRequested = false;
	const frame = composite(layers, { photo: photoPart, text: textMask });
	context.putImageData(new ImageData(toRgba(frame), FRAME_WIDTH, FRAME_HEIGHT), 0, 0);
	showBounds();
	const layer = findLayer(layers, activeId);
	document.getElementById("text-overflow").hidden = layer?.kind !== "text" || !lettered(layer).overflow;
}

/**
 * A photo's pixels inside the frame (layers.js's photoPart): dithered, or only adjusted while it's moved or
 * resized, which stays smooth on a phone.
 */
function photoPart(layer) {
	const rect = layerRect(layer);
	const part = visiblePart(rect);
	if (!part) {
		return null;
	}
	const { crop } = layer;
	const place = [rect.left, rect.top, rect.width, rect.height, crop.left, crop.top, crop.width, crop.height].join();
	let cached = photoCache.get(layer.id);
	if (cached?.place !== place) {
		cached = { place, gray: cropGray(layer, rect, part) };
		photoCache.set(layer.id, cached);
	}
	if (layer.id === roughPhotoId) {
		return { ...part, values: adjust(cached.gray, layer) };
	}
	const settings = [layer.brightness, layer.contrast, layer.method].join();
	if (cached.settings !== settings) {
		cached.settings = settings;
		cached.values = render(cached.gray, part.width, part.height, layer);
	}
	return { ...part, values: cached.values };
}

/** The photo's crop drawn in its place, and the part inside the frame read back as gray values. */
function cropGray({ source, crop }, rect, part) {
	cropContext.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
	cropContext.imageSmoothingQuality = "high";
	const { left, top, width, height } = rect;
	cropContext.drawImage(source, crop.left, crop.top, crop.width, crop.height, left, top, width, height);
	return grayscale(cropContext.getImageData(part.left, part.top, part.width, part.height).data);
}

function layerRect(layer) {
	return photoRect(layer.source.width, layer.source.height, layer.scale, layer.centerX, layer.centerY, layer.crop);
}

/** A text layer's mask (layers.js's text): 1 where the text is, 0 around it, in its box. */
function textMask(layer) {
	return lettered(layer).mask;
}

/**
 * A text drawn in the font in its box, wrapped to its width (D50), as a mask: 1 where the drawing is at
 * least half opaque. Lines past the box's bottom are left out, and `overflow` says so.
 */
function lettered(layer) {
	const key = [layer.text, layer.size, layer.align, layer.width, layer.height].join("\n");
	const cached = textCache.get(layer.id);
	if (cached?.key === key) {
		return cached;
	}
	// Setting the size clears the canvas and its settings.
	lettering.width = layer.width;
	lettering.height = layer.height;
	letteringContext.font = TEXT_FONT.replace("SIZE", layer.size);
	const measure = (text) => letteringContext.measureText(text).width;
	const lines = wrap(layer.text, layer.width, measure);
	const lineHeight = Math.round(layer.size * LINE_HEIGHT);
	const shown = lines.slice(0, Math.floor(layer.height / lineHeight));
	shown.forEach((line, index) => {
		const x = lineX(measure(line), layer.width, layer.align);
		letteringContext.fillText(line, x, index * lineHeight + Math.round(layer.size * BASELINE));
	});
	const alpha = letteringContext.getImageData(0, 0, layer.width, layer.height).data;
	const mask = new Uint8Array(layer.width * layer.height);
	for (let i = 0; i < mask.length; i++) {
		mask[i] = alpha[i * 4 + 3] >= 128 ? 1 : 0;
	}
	const overflow = lines.slice(shown.length).some((line) => line.trim() !== "");
	const result = { key, mask, overflow };
	textCache.set(layer.id, result);
	return result;
}

/**
 * The outline of the active photo, so a collage shows where each photo is, with handles to crop it while the
 * Move tool is chosen; or of the active text's box, with handles to resize it while the Text or Move tool is.
 */
function showBounds() {
	const layer = findLayer(layers, activeId);
	bounds.hidden = !["photo", "text"].includes(layer?.kind) || !layer.visible;
	if (bounds.hidden) {
		return;
	}
	const handles = tool === "move" || (tool === "text" && layer.kind === "text");
	bounds.classList.toggle("editor__bounds--handles", handles);
	const rect = layer.kind === "photo" ? layerRect(layer) : layer;
	bounds.style.left = `${(rect.left / FRAME_WIDTH) * 100}%`;
	bounds.style.top = `${(rect.top / FRAME_HEIGHT) * 100}%`;
	bounds.style.width = `${(rect.width / FRAME_WIDTH) * 100}%`;
	bounds.style.height = `${(rect.height / FRAME_HEIGHT) * 100}%`;
}

// ---------- Tools ----------

function setTool(name) {
	tool = name;
	for (const button of toolButtons) {
		button.setAttribute("aria-pressed", String(button.dataset.tool === name));
	}
	for (const option of toolOptions) {
		option.hidden = !option.dataset.tools.split(" ").includes(name);
	}
	document.getElementById("tool-hint").textContent = TOOL_HINTS[name];
	updateCursor();
	showGrid();
	showBounds();
}

/** The Pixel tool's grid over the frame, while it's chosen and its cells are big enough to see. */
function showGrid() {
	const size = Number(cellSize.value);
	grid.hidden = tool !== "pixel" || (canvas.offsetWidth * size) / FRAME_WIDTH < MIN_GRID_CELL;
	grid.style.backgroundSize = `${(size / FRAME_WIDTH) * 100}% ${(size / FRAME_HEIGHT) * 100}%`;
}

function switchColor() {
	color = color === BLACK ? WHITE : BLACK;
	const [now, other] = color === BLACK ? ["black", "white"] : ["white", "black"];
	colorButton.dataset.color = now;
	colorButton.setAttribute("aria-label", `Color: ${now}. Switch to ${other}`);
}

function updateCursor() {
	if (gesture?.kind === "pan") {
		area.dataset.cursor = "grabbing";
	} else if (spaceDown || tool === "hand") {
		area.dataset.cursor = "grab";
	} else {
		area.dataset.cursor = { move: "move", text: "text" }[tool] ?? "crosshair";
	}
}

// Pointer Events cover the mouse and touch; touch-action: none keeps the page from scrolling.
function startGesture(event) {
	if (gesture) {
		return;
	}
	const panning = event.button === 1 || (event.button === 0 && (tool === "hand" || spaceDown));
	if ((!panning && event.button !== 0) || onScrollbar(event)) {
		return;
	}
	const box = canvas.getBoundingClientRect();
	const handle = event.target.closest("[data-handle]");
	if (panning) {
		gesture = { kind: "pan", x: event.clientX, y: event.clientY, left: area.scrollLeft, top: area.scrollTop };
	} else if (handle) {
		gesture = startResize(event, box, handle.dataset.handle);
	} else if (tool === "move") {
		gesture = startMove(event, box);
	} else if (tool === "text") {
		gesture = startText(framePoint(event.clientX, event.clientY, box));
	} else {
		gesture = startDrawing(framePoint(event.clientX, event.clientY, box));
	}
	if (gesture) {
		gesture.pointerId = event.pointerId;
		area.setPointerCapture(event.pointerId);
		updateCursor();
	}
}

function continueGesture(event) {
	if (gesture?.pointerId !== event.pointerId) {
		return;
	}
	if (gesture.kind === "pan") {
		area.scrollLeft = gesture.left - (event.clientX - gesture.x);
		area.scrollTop = gesture.top - (event.clientY - gesture.y);
	} else if (gesture.kind === "move") {
		continueMove(event);
	} else if (gesture.kind === "resize") {
		continueResize(event);
	} else if (gesture.kind === "box") {
		continueText(framePoint(event.clientX, event.clientY, canvas.getBoundingClientRect()));
	} else if (gesture.kind === "draw") {
		continueDrawing(framePoint(event.clientX, event.clientY, canvas.getBoundingClientRect()));
	}
}

function endGesture(event) {
	if (gesture?.pointerId !== event.pointerId) {
		return;
	}
	const ended = gesture;
	gesture = null;
	roughPhotoId = null;
	updateCursor();
	if (ended.kind === "pan") {
		return;
	}
	if (ended.kind === "pick") {
		textInput.focus();
		return;
	}
	if (ended.kind === "box") {
		endText(ended);
		return;
	}
	if (ended.changed) {
		commit(layers);
	} else {
		cancel(ended);
	}
}

function cancelGesture(event) {
	if (gesture?.pointerId === event.pointerId) {
		const cancelled = gesture;
		gesture = null;
		roughPhotoId = null;
		updateCursor();
		cancel(cancelled);
	}
}

/** The area's own scrollbars get the pointer too; they only scroll. */
function onScrollbar(event) {
	const box = area.getBoundingClientRect();
	return (
		event.clientX - box.left - area.clientLeft >= area.clientWidth ||
		event.clientY - box.top - area.clientTop >= area.clientHeight
	);
}

/** Back to the history's current list, as if the drag never happened. */
function cancel(ended) {
	if (ended.activeId !== undefined) {
		activeId = ended.activeId;
	}
	layers = steps.current;
	refresh();
}

function startMove(event, box) {
	const layer = findLayer(steps.current, activeId);
	if (!layer) {
		return null;
	}
	if (layer.kind === "photo") {
		roughPhotoId = layer.id;
	}
	return { kind: "move", layer, x: event.clientX, y: event.clientY, scale: FRAME_WIDTH / box.width, dx: 0, dy: 0 };
}

function continueMove(event) {
	const dx = Math.round((event.clientX - gesture.x) * gesture.scale);
	const dy = Math.round((event.clientY - gesture.y) * gesture.scale);
	if (dx === gesture.dx && dy === gesture.dy) {
		return;
	}
	Object.assign(gesture, { dx, dy, changed: dx !== 0 || dy !== 0 });
	layers = updateLayer(steps.current, gesture.layer.id, moved(gesture.layer, dx, dy));
	redraw();
}

/**
 * A photo's center moves, and a text's box; a drawing's pixels do, and what goes past the edge is lost once let
 * go.
 */
function moved(layer, dx, dy) {
	if (layer.kind === "photo") {
		return { centerX: layer.centerX + dx, centerY: layer.centerY + dy };
	}
	if (layer.kind === "text") {
		return { left: layer.left + dx, top: layer.top + dy };
	}
	return { pixels: shift(layer.pixels, dx, dy) };
}

/** A handle of the active text's box (D50) or photo (D58) moves the edges it holds: it resizes a box, crops a photo. */
function startResize(event, box, handle) {
	const layer = findLayer(steps.current, activeId);
	if (layer.kind === "photo") {
		roughPhotoId = layer.id;
	}
	return { kind: "resize", layer, handle, x: event.clientX, y: event.clientY, scale: FRAME_WIDTH / box.width };
}

function continueResize(event) {
	const dx = Math.round((event.clientX - gesture.x) * gesture.scale);
	const dy = Math.round((event.clientY - gesture.y) * gesture.scale);
	gesture.changed = dx !== 0 || dy !== 0;
	const { layer, handle } = gesture;
	const changes = layer.kind === "photo" ? cropPhoto(layer, handle, dx, dy) : resizeBox(layer, handle, dx, dy);
	layers = updateLayer(steps.current, layer.id, changes);
	redraw();
}

/**
 * The Text tool: on a text, it picks it to be changed; elsewhere, dragging makes a new text box above the active
 * layer, in the color and the style last chosen.
 */
function startText(point) {
	const hit = textLayerAt(steps.current, point);
	if (hit) {
		activeId = hit.id;
		refresh();
		// Focused once the pointer is up, or the click would focus the canvas again.
		return { kind: "pick" };
	}
	const previousId = activeId;
	const layer = textLayer(nextId++, `Text ${++textCount}`, boxBetween(point, point), { ...textStyle, color });
	activeId = layer.id;
	layers = insertAbove(steps.current, previousId, layer);
	redraw();
	return { kind: "box", layer, from: point, activeId: previousId };
}

function continueText(point) {
	layers = insertAbove(steps.current, gesture.activeId, { ...gesture.layer, ...boxBetween(gesture.from, point) });
	redraw();
}

/** A click, or a box too thin for a line, gets a usable size; then the text is typed in its field. */
function endText(ended) {
	const layer = findLayer(layers, ended.layer.id);
	const lineHeight = Math.round(layer.size * LINE_HEIGHT);
	const width = layer.width < MIN_BOX ? CLICK_BOX_WIDTH : layer.width;
	const height = layer.height < lineHeight ? 2 * lineHeight : layer.height;
	// A box made bigger stays inside the frame when it fits.
	const left = width === layer.width ? layer.left : Math.max(0, Math.min(layer.left, FRAME_WIDTH - width));
	const top = height === layer.height ? layer.top : Math.max(0, Math.min(layer.top, FRAME_HEIGHT - height));
	commit(updateLayer(layers, layer.id, { left, top, width, height }));
	textInput.focus();
}

function moveWithKeys(event) {
	const move = KEY_MOVES[event.key];
	const layer = findLayer(steps.current, activeId);
	if (!move || tool !== "move" || gesture || !layer) {
		return;
	}
	event.preventDefault();
	const step = event.shiftKey ? BIG_STEP : 1;
	commit(updateLayer(steps.current, layer.id, moved(layer, move[0] * step, move[1] * step)));
}

/**
 * A drawing tool draws on a copy of the active layer's pixels, which becomes the layer once let go. On a photo,
 * or with no layer, it draws on a new layer above.
 */
function startDrawing(point) {
	const previousId = activeId;
	let list = steps.current;
	let target = findLayer(list, activeId);
	if (target?.kind !== "drawing") {
		target = drawingLayer(nextId++, `Layer ${++drawingCount}`);
		list = insertAbove(list, activeId, target);
		activeId = target.id;
	}
	const pixels = target.pixels.slice();
	layers = updateLayer(list, target.id, { pixels });
	const started = { kind: "draw", tool, base: target.pixels, pixels, from: point, last: point, activeId: previousId };
	if (tool === "bucket") {
		if (floodFill(pixels, point.x, point.y, color)) {
			commit(layers);
		} else {
			cancel(started);
		}
		return null;
	}
	if (tool === "pencil" || tool === "eraser") {
		line(pixels, point, point, Number(brush.value), paint(tool));
		started.changed = true;
	}
	if (tool === "pixel") {
		const size = Number(cellSize.value);
		const cell = cellOf(point, size);
		Object.assign(started, { size, cell });
		cellLine(pixels, cell, cell, size, color);
		started.changed = true;
	}
	redraw();
	return started;
}

function continueDrawing(point) {
	if (point.x === gesture.last.x && point.y === gesture.last.y) {
		return;
	}
	const { pixels, from } = gesture;
	if (gesture.tool === "pixel") {
		const cell = cellOf(point, gesture.size);
		cellLine(pixels, gesture.cell, cell, gesture.size, color);
		gesture.cell = cell;
	} else if (gesture.tool === "pencil" || gesture.tool === "eraser") {
		line(pixels, gesture.last, point, Number(brush.value), paint(gesture.tool));
	} else {
		// The shape so far, on the layer as it was.
		pixels.set(gesture.base);
		const shape = { color, border: Number(border.value), fill: FILLS[fill.value] };
		if (gesture.tool === "line") {
			line(pixels, from, point, Number(brush.value), color);
		} else if (gesture.tool === "rectangle") {
			rectangle(pixels, from, point, shape);
		} else {
			ellipse(pixels, from, point, shape);
		}
		gesture.changed = true;
	}
	gesture.last = point;
	redraw();
}

function paint(drawingTool) {
	return drawingTool === "eraser" ? CLEAR : color;
}

// ---------- Zoom ----------

function fit() {
	const style = getComputedStyle(area);
	const width = area.offsetWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
	const height = area.offsetHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
	return fitZoom(width, height, devicePixelRatio);
}

function applyZoom() {
	const current = zoom ?? fit();
	// Fit rounds down, so it never overflows by a fraction and shows scrollbars.
	const width = cssWidth(current, devicePixelRatio);
	canvas.style.width = `${zoom === null ? Math.floor(width) : width}px`;
	zoomValue.textContent = `${Math.round(current * 100)}%`;
	document.getElementById("zoom-fit").setAttribute("aria-pressed", String(zoom === null));
	document.getElementById("zoom-actual").setAttribute("aria-pressed", String(zoom === 1));
	showGrid();
}

/** A zoom, or Fit (null), keeping the point of the frame at (clientX, clientY) in place: by default the middle. */
function zoomTo(next, clientX, clientY) {
	const view = area.getBoundingClientRect();
	const x = clientX ?? view.left + view.width / 2;
	const y = clientY ?? view.top + view.height / 2;
	const before = canvas.getBoundingClientRect();
	zoom = next;
	applyZoom();
	const after = canvas.getBoundingClientRect();
	area.scrollLeft += scrollToKeep(x, { start: before.left, size: before.width }, { start: after.left, size: after.width });
	area.scrollTop += scrollToKeep(y, { start: before.top, size: before.height }, { start: after.top, size: after.height });
}

function zoomStep(direction, clientX, clientY) {
	const fitted = fit();
	const next = stepZoom(zoom ?? fitted, fitted, direction);
	zoomTo(next === fitted ? null : next, clientX, clientY);
}

function zoomWithWheel(event) {
	if (!event.ctrlKey && !event.metaKey) {
		return;
	}
	event.preventDefault();
	// In lines or pages (Firefox with a mouse), every event is a step.
	wheel += event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? event.deltaY : Math.sign(event.deltaY) * WHEEL_STEP;
	if (Math.abs(wheel) >= WHEEL_STEP) {
		zoomStep(wheel < 0 ? 1 : -1, event.clientX, event.clientY);
		wheel = 0;
	}
}

// ---------- Keys ----------

function shortcut(event) {
	if (event.target.matches("input, select, textarea")) {
		return;
	}
	const key = event.key.toLowerCase();
	if (event.ctrlKey || event.metaKey) {
		if (key === "z" || key === "y") {
			event.preventDefault();
			if (key === "y" || event.shiftKey) {
				redo();
			} else {
				undo();
			}
		}
		return;
	}
	if (event.altKey) {
		return;
	}
	// Space scrolls the view while held, unless it's pressing a button.
	if (event.key === " " && (event.target === document.body || event.target === canvas)) {
		event.preventDefault();
		spaceDown = true;
		updateCursor();
		return;
	}
	if (gesture) {
		return;
	}
	if (TOOL_KEYS[key]) {
		setTool(TOOL_KEYS[key]);
	} else if (key === "x") {
		switchColor();
	} else if (key === "+" || key === "=") {
		zoomStep(1);
	} else if (key === "-") {
		zoomStep(-1);
	} else if (key === "0") {
		zoomTo(null);
	} else if (key === "1") {
		zoomTo(1);
	} else {
		return;
	}
	event.preventDefault();
}

// ---------- Save ----------

async function save() {
	const name = nameInput.value.trim();
	if (name === "") {
		showFieldErrors(form, [{ field: "name", message: "Enter a name" }]);
		return;
	}
	clearFieldErrors(form);
	const body = new FormData();
	body.append("name", name);
	body.append("image", await png(), "frame.png");
	try {
		await api("/api/frames", { method: "POST", body });
	} catch (error) {
		// The server checks every pixel, so a 400 for the image shouldn't happen; its detail says why.
		showFormError(form, error);
		return;
	}
	saved = true;
	location.assign("/frames");
}

/** The visible layers flattened, every pixel exactly 0 or 255 with alpha 255, as the API takes it (D41). */
function png() {
	const pixels = composite(steps.current, { photo: photoPart, text: textMask });
	const flat = document.createElement("canvas");
	flat.width = FRAME_WIDTH;
	flat.height = FRAME_HEIGHT;
	flat.getContext("2d").putImageData(new ImageData(toRgba(pixels), FRAME_WIDTH, FRAME_HEIGHT), 0, 0);
	return new Promise((resolve, reject) => {
		flat.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The PNG couldn't be made"))), "image/png");
	});
}
