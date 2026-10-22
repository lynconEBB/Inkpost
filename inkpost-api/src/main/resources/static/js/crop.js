// Crop to fill (D44), with no DOM: the photo is scaled to cover the frame, centered, and the drag offset
// is clamped so the frame is always covered.

export const FRAME_WIDTH = 800;
export const FRAME_HEIGHT = 480;

/** The smallest scale at which the photo covers the frame. */
export function coverScale(width, height) {
	return Math.max(FRAME_WIDTH / width, FRAME_HEIGHT / height);
}

/**
 * The photo's size at the cover scale. A photo wider than 5:3 is exactly as tall as the frame, so it only
 * moves sideways; a taller one is exactly as wide, so it only moves up and down.
 */
export function coverSize(width, height) {
	if (width * FRAME_HEIGHT >= height * FRAME_WIDTH) {
		return { width: (width * FRAME_HEIGHT) / height, height: FRAME_HEIGHT };
	}
	return { width: FRAME_WIDTH, height: (height * FRAME_WIDTH) / width };
}

/** Where the scaled photo's top-left corner goes, in frame pixels, for it to be centered. */
export function centered(size) {
	return { x: (FRAME_WIDTH - size.width) / 2, y: (FRAME_HEIGHT - size.height) / 2 };
}

/** The offset, moved back where the photo still covers the whole frame: between −overflow and 0. */
export function clampOffset(offset, size) {
	return {
		x: clamp(offset.x, FRAME_WIDTH - size.width, 0),
		y: clamp(offset.y, FRAME_HEIGHT - size.height, 0),
	};
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
