// A photo's size and place in the frame (D44, D47), with no DOM. Its size is a scale of the size that
// covers the frame: at 1 it covers the frame, as a new photo layer does.

export const FRAME_WIDTH = 800;
export const FRAME_HEIGHT = 480;

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

/**
 * Where the photo is in the frame, in whole pixels: its cover size times `scale`, around its center. The
 * center is a frame position and may be anywhere, so is the rectangle.
 */
export function photoRect(width, height, scale, centerX, centerY) {
	const cover = coverSize(width, height);
	const rectWidth = Math.max(1, Math.round(cover.width * scale));
	const rectHeight = Math.max(1, Math.round(cover.height * scale));
	return {
		left: Math.round(centerX - rectWidth / 2),
		top: Math.round(centerY - rectHeight / 2),
		width: rectWidth,
		height: rectHeight,
	};
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
