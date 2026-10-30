// A photo's size, crop and place in the frame (D44, D47, D58), with no DOM. Its size is a scale of the size
// that covers the frame: at 1 the whole photo covers the frame, as a new photo layer does. Its crop is the
// rectangle of the photo it shows, `{ left, top, width, height }` in the photo's own pixels, and its center
// is the crop's.

export const FRAME_WIDTH = 800;
export const FRAME_HEIGHT = 480;

/** The smallest a crop gets, either way, in frame pixels, as a text box (MIN_BOX). */
export const MIN_CROP = 16;

/** The smallest scale at which the photo covers the frame. */
export function coverScale(width, height) {
	return Math.max(FRAME_WIDTH / width, FRAME_HEIGHT / height);
}

/**
 * The photo's size at the cover scale. A photo wider than 5:3 is exactly as tall as the frame; a taller one
 * is exactly as wide.
 */
export function coverSize(width, height) {
	if (width * FRAME_HEIGHT >= height * FRAME_WIDTH) {
		return { width: (width * FRAME_HEIGHT) / height, height: FRAME_HEIGHT };
	}
	return { width: FRAME_WIDTH, height: (height * FRAME_WIDTH) / width };
}

/** The scale, of the cover size, at which the whole photo is inside the frame. */
export function fitScale(width, height) {
	return Math.min(FRAME_WIDTH / width, FRAME_HEIGHT / height) / coverScale(width, height);
}

/** The scale at which a crop of the photo covers the frame: 1 for the whole photo. */
export function cropCoverScale(width, height, crop) {
	return coverScale(crop.width, crop.height) / coverScale(width, height);
}

/** The whole photo, as a crop. */
export function wholePhoto(width, height) {
	return { left: 0, top: 0, width, height };
}

/**
 * Where the photo's crop is in the frame, in whole pixels: its part of the cover size times `scale`, around
 * its center. The center is a frame position and may be anywhere, so is the rectangle.
 */
export function photoRect(width, height, scale, centerX, centerY, crop = wholePhoto(width, height)) {
	const cover = coverSize(width, height);
	const rectWidth = Math.max(1, Math.round(cover.width * scale * (crop.width / width)));
	const rectHeight = Math.max(1, Math.round(cover.height * scale * (crop.height / height)));
	return {
		left: Math.round(centerX - rectWidth / 2),
		top: Math.round(centerY - rectHeight / 2),
		width: rectWidth,
		height: rectHeight,
	};
}

/**
 * A photo layer's crop with the edges a handle holds moved by (dx, dy) frame pixels ("n", "s", "e", "w", or a
 * corner like "nw"), and its new center: `{ crop, centerX, centerY }`. The photo stays where it is and the same
 * size, so an edge hides or shows it there. An edge stops at the photo's own edge, and MIN_CROP away from the
 * opposite one (or where it is, if they're closer already).
 */
export function cropPhoto(layer, handle, dx, dy) {
	const { source, crop, scale } = layer;
	// Frame pixels per photo pixel.
	const zoom = coverScale(source.width, source.height) * scale;
	const across = cropAxis(layer.centerX, crop.left, crop.width, source.width, zoom, {
		start: handle.includes("w") ? dx : 0,
		end: handle.includes("e") ? dx : 0,
	});
	const down = cropAxis(layer.centerY, crop.top, crop.height, source.height, zoom, {
		start: handle.includes("n") ? dy : 0,
		end: handle.includes("s") ? dy : 0,
	});
	return {
		crop: { left: across.from, top: down.from, width: across.size, height: down.size },
		centerX: across.center,
		centerY: down.center,
	};
}

/** One way of cropPhoto: the crop's start and size, in photo pixels, and its center, with its edges moved. */
function cropAxis(center, from, size, whole, zoom, move) {
	const start = center - (size * zoom) / 2;
	const end = center + (size * zoom) / 2;
	const photoStart = start - from * zoom;
	const photoEnd = photoStart + whole * zoom;
	const gap = Math.min(MIN_CROP, end - start);
	const newStart = Math.min(Math.max(start + move.start, photoStart), end - gap);
	const newEnd = Math.max(Math.min(end + move.end, photoEnd), newStart + gap);
	return { from: (newStart - photoStart) / zoom, size: (newEnd - newStart) / zoom, center: (newStart + newEnd) / 2 };
}

/** The part of a rectangle that is inside the frame, or null if none of it is. */
export function visiblePart(rect) {
	const left = Math.max(0, rect.left);
	const top = Math.max(0, rect.top);
	const right = Math.min(FRAME_WIDTH, rect.left + rect.width);
	const bottom = Math.min(FRAME_HEIGHT, rect.top + rect.height);
	if (left >= right || top >= bottom) {
		return null;
	}
	return { left, top, width: right - left, height: bottom - top };
}
