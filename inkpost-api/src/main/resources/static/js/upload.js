// The upload page: a photo becomes the 800×480 black and white PNG the API takes (D41), all in the browser
// (D19, D44), then goes to POST /api/frames.
import { api } from "./api.js";
import { centered, clampOffset, coverSize, FRAME_HEIGHT, FRAME_WIDTH } from "./crop.js";
import { adjust, DEFAULT_SETTINGS, grayscale, render, toRgba } from "./dither.js";
import { busy, clearFieldErrors, showError, showFieldErrors, showFormError } from "./ui.js";

const NAME_LENGTH = 100;
/** How far an arrow key moves the photo, in frame pixels; it moves the way a drag would. */
const KEY_STEP = 20;
const KEY_MOVES = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

const form = document.getElementById("upload-form");
const fileInput = document.getElementById("photo");
const preview = document.getElementById("preview");
const previewContext = preview.getContext("2d");
const brightness = document.getElementById("brightness");
const contrast = document.getElementById("contrast");
const method = document.getElementById("method");
const nameInput = document.getElementById("name");
const uploadButton = document.getElementById("upload");

// The crop in color, read back as pixels.
const crop = document.createElement("canvas");
crop.width = FRAME_WIDTH;
crop.height = FRAME_HEIGHT;
const cropContext = crop.getContext("2d", { willReadFrequently: true });

let photo = null;
/** The photo's size at the cover scale, and where its top-left corner is, in frame pixels. */
let size = null;
let offset = null;
/** The crop's grayscale, before brightness and contrast. */
let gray = null;
let dragging = null;
let defaultName = "";
let cropChanged = false;
let frameRequested = false;

fileInput.addEventListener("change", () => choose(fileInput.files[0]));
for (const slider of [brightness, contrast]) {
	slider.addEventListener("input", () => {
		document.getElementById(`${slider.id}-value`).textContent = slider.value;
		redraw();
	});
}
method.addEventListener("change", () => redraw());
document.getElementById("reset").addEventListener("click", reset);
document.getElementById("fit").addEventListener("click", () => showActualPixels(false));
document.getElementById("actual").addEventListener("click", () => showActualPixels(true));
preview.addEventListener("pointerdown", startDrag);
preview.addEventListener("pointermove", drag);
preview.addEventListener("pointerup", endDrag);
preview.addEventListener("pointercancel", endDrag);
preview.addEventListener("keydown", moveWithKeys);
form.addEventListener("submit", (event) => {
	event.preventDefault();
	busy(uploadButton, upload);
});

async function choose(file) {
	if (!file) {
		return;
	}
	let bitmap;
	try {
		bitmap = await decode(file);
	} catch {
		showError("Can't read this image, use a JPEG or PNG.");
		return;
	}
	photo?.close();
	photo = bitmap;
	size = coverSize(photo.width, photo.height);
	offset = centered(size);

	// The name follows the file, unless it was typed.
	const name = file.name.replace(/\.[^.]*$/, "").trim().slice(0, NAME_LENGTH);
	if (nameInput.value === defaultName) {
		nameInput.value = name;
	}
	defaultName = name;

	const fileName = document.getElementById("file-name");
	fileName.textContent = `${file.name}, ${photo.width} × ${photo.height}`;
	fileName.hidden = false;
	document.getElementById("choose").textContent = "Choose another photo";
	document.getElementById("preview-empty").hidden = true;
	document.getElementById("crop-hint").hidden = false;
	document.getElementById("adjust").disabled = false;
	preview.hidden = false;
	uploadButton.disabled = false;
	redraw({ recrop: true });
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

function settings() {
	return { brightness: Number(brightness.value), contrast: Number(contrast.value), method: method.value };
}

function reset() {
	brightness.value = DEFAULT_SETTINGS.brightness;
	contrast.value = DEFAULT_SETTINGS.contrast;
	method.value = DEFAULT_SETTINGS.method;
	document.getElementById("brightness-value").textContent = brightness.value;
	document.getElementById("contrast-value").textContent = contrast.value;
	redraw();
}

/** At most once per frame. A moved photo is cropped again; the sliders only dither again. */
function redraw({ recrop = false } = {}) {
	cropChanged ||= recrop;
	if (!frameRequested) {
		frameRequested = true;
		requestAnimationFrame(draw);
	}
}

/** While dragging, the grayscale is enough and stays smooth on a phone; the release dithers. */
function draw() {
	frameRequested = false;
	if (!photo) {
		return;
	}
	if (cropChanged) {
		gray = cropGray();
		cropChanged = false;
	}
	const pixels = dragging ? adjust(gray, settings()) : render(gray, FRAME_WIDTH, FRAME_HEIGHT, settings());
	previewContext.putImageData(new ImageData(toRgba(pixels), FRAME_WIDTH, FRAME_HEIGHT), 0, 0);
}

function cropGray() {
	cropContext.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
	cropContext.imageSmoothingQuality = "high";
	cropContext.drawImage(photo, offset.x, offset.y, size.width, size.height);
	return grayscale(cropContext.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data);
}

// Pointer Events cover the mouse and touch; touch-action: none keeps the page from scrolling.
function startDrag(event) {
	if (!photo || dragging) {
		return;
	}
	preview.setPointerCapture(event.pointerId);
	dragging = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offset };
}

function drag(event) {
	if (dragging?.pointerId !== event.pointerId) {
		return;
	}
	const framePixelsPerCssPixel = FRAME_WIDTH / preview.getBoundingClientRect().width;
	moveTo({
		x: dragging.offset.x + (event.clientX - dragging.x) * framePixelsPerCssPixel,
		y: dragging.offset.y + (event.clientY - dragging.y) * framePixelsPerCssPixel,
	});
}

function endDrag(event) {
	if (dragging?.pointerId === event.pointerId) {
		dragging = null;
		redraw();
	}
}

function moveWithKeys(event) {
	const move = KEY_MOVES[event.key];
	if (!photo || !move) {
		return;
	}
	event.preventDefault();
	moveTo({ x: offset.x + move[0] * KEY_STEP, y: offset.y + move[1] * KEY_STEP });
}

function moveTo(wanted) {
	offset = clampOffset(wanted, size);
	redraw({ recrop: true });
}

/** One frame pixel per screen pixel, which fits most phones; or the available width. */
function showActualPixels(actual) {
	preview.style.width = actual ? `${FRAME_WIDTH / devicePixelRatio}px` : "";
	document.getElementById("preview-box").classList.toggle("preview--actual", actual);
	document.getElementById("fit").setAttribute("aria-pressed", String(!actual));
	document.getElementById("actual").setAttribute("aria-pressed", String(actual));
}

async function upload() {
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
	location.assign("/frames");
}

/** The dithered crop, every pixel exactly 0 or 255 with alpha 255, as the API takes it (D41). */
function png() {
	const pixels = render(cropGray(), FRAME_WIDTH, FRAME_HEIGHT, settings());
	const canvas = document.createElement("canvas");
	canvas.width = FRAME_WIDTH;
	canvas.height = FRAME_HEIGHT;
	canvas.getContext("2d").putImageData(new ImageData(toRgba(pixels), FRAME_WIDTH, FRAME_HEIGHT), 0, 0);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The PNG couldn't be made"))), "image/png");
	});
}
