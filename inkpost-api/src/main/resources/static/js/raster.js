// Drawing on a drawing layer's pixels (D47, D48), with no DOM. A layer is a frame-sized Uint8Array, one
// value per pixel, rows top to bottom: CLEAR (see-through), BLACK or WHITE. Points are whole frame pixels
// and may be outside the frame: whatever falls outside is left out.
import { FRAME_HEIGHT, FRAME_WIDTH } from "./crop.js";

export const CLEAR = 0;
export const BLACK = 1;
export const WHITE = 2;

/** A layer with nothing on it. */
export function blank() {
	return new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT);
}

/** A square brush of `size` pixels, centered on the point (one pixel more to the right and down when even). */
export function stamp(pixels, x, y, size, color) {
	const left = x - Math.floor((size - 1) / 2);
	const top = y - Math.floor((size - 1) / 2);
	for (let row = top; row < top + size; row++) {
		span(pixels, row, left, left + size - 1, color);
	}
}

/** The brush stamped on every pixel from one point to the other (Bresenham), so a line has no gaps. */
export function line(pixels, from, to, size, color) {
	let { x, y } = from;
	const dx = Math.abs(to.x - x);
	const dy = -Math.abs(to.y - y);
	const stepX = x < to.x ? 1 : -1;
	const stepY = y < to.y ? 1 : -1;
	let error = dx + dy;
	for (;;) {
		stamp(pixels, x, y, size, color);
		if (x === to.x && y === to.y) {
			return;
		}
		const twice = 2 * error;
		if (twice >= dy) {
			error += dy;
			x += stepX;
		}
		if (twice <= dx) {
			error += dx;
			y += stepY;
		}
	}
}

/**
 * The rectangle with these two opposite corners, both included. `border` pixels thick in `color` (0 for
 * none), filled with `fill` inside the border (null for none).
 */
export function rectangle(pixels, from, to, { color, border, fill }) {
	shape(pixels, box(from, to), border, color, fill, (b) => [b.left, b.right]);
}

/** The ellipse inside the rectangle with these two opposite corners, with a border and fill like rectangle. */
export function ellipse(pixels, from, to, { color, border, fill }) {
	shape(pixels, box(from, to), border, color, fill, ellipseSpan);
}

/**
 * Paints with `color` the pixel at (x, y) and every pixel of the same value reached from it through the 4
 * neighbours (never diagonally), on this layer only; see-through counts as a value. Returns false when
 * nothing changed.
 */
export function floodFill(pixels, x, y, color) {
	if (!inFrame(x, y)) {
		return false;
	}
	const target = pixels[y * FRAME_WIDTH + x];
	if (target === color) {
		return false;
	}
	// Each pixel is painted when it's queued, so it's queued at most once.
	const queue = new Int32Array(pixels.length);
	let length = 0;
	const visit = (index) => {
		if (pixels[index] === target) {
			pixels[index] = color;
			queue[length++] = index;
		}
	};
	visit(y * FRAME_WIDTH + x);
	while (length > 0) {
		const index = queue[--length];
		const column = index % FRAME_WIDTH;
		if (column > 0) {
			visit(index - 1);
		}
		if (column < FRAME_WIDTH - 1) {
			visit(index + 1);
		}
		if (index >= FRAME_WIDTH) {
			visit(index - FRAME_WIDTH);
		}
		if (index < pixels.length - FRAME_WIDTH) {
			visit(index + FRAME_WIDTH);
		}
	}
	return true;
}

/** A copy moved by whole pixels; what goes past the frame's edge is lost, and what's uncovered is clear. */
export function shift(pixels, dx, dy) {
	const moved = blank();
	for (let y = Math.max(0, dy); y < Math.min(FRAME_HEIGHT, FRAME_HEIGHT + dy); y++) {
		const from = (y - dy) * FRAME_WIDTH;
		const left = Math.max(0, dx);
		const right = Math.min(FRAME_WIDTH, FRAME_WIDTH + dx);
		moved.set(pixels.subarray(from + left - dx, from + right - dx), y * FRAME_WIDTH + left);
	}
	return moved;
}

/** The box between two opposite corners, whichever they are. */
function box(from, to) {
	return {
		left: Math.min(from.x, to.x),
		top: Math.min(from.y, to.y),
		right: Math.max(from.x, to.x),
		bottom: Math.max(from.y, to.y),
	};
}

/**
 * A shape drawn row by row. `spanOf(box, y)` is the shape's [left, right] on row y of a box, or null. The
 * border is the shape minus the same shape in the box shrunk by `border` on every side; the fill is that
 * smaller shape.
 */
function shape(pixels, outer, border, color, fill, spanOf) {
	const inner = {
		left: outer.left + border,
		top: outer.top + border,
		right: outer.right - border,
		bottom: outer.bottom - border,
	};
	const hasInside = inner.left <= inner.right && inner.top <= inner.bottom;
	for (let y = Math.max(0, outer.top); y <= Math.min(FRAME_HEIGHT - 1, outer.bottom); y++) {
		const whole = spanOf(outer, y);
		if (!whole) {
			continue;
		}
		const hole = hasInside && y >= inner.top && y <= inner.bottom ? spanOf(inner, y) : null;
		if (!hole) {
			span(pixels, y, whole[0], whole[1], color);
			continue;
		}
		span(pixels, y, whole[0], hole[0] - 1, color);
		span(pixels, y, hole[1] + 1, whole[1], color);
		if (fill !== null) {
			span(pixels, y, hole[0], hole[1], fill);
		}
	}
}

/** The pixels of row y whose centers are inside the ellipse that touches the box's four sides. */
function ellipseSpan(b, y) {
	const radiusX = (b.right - b.left + 1) / 2;
	const radiusY = (b.bottom - b.top + 1) / 2;
	const dy = (y + 0.5 - (b.top + radiusY)) / radiusY;
	const half = radiusX * Math.sqrt(Math.max(0, 1 - dy * dy));
	const middle = b.left + radiusX - 0.5;
	const left = Math.ceil(middle - half);
	const right = Math.floor(middle + half);
	return left <= right ? [left, right] : null;
}

/** Row y from left to right, both included, clipped to the frame. */
function span(pixels, y, left, right, color) {
	if (y < 0 || y >= FRAME_HEIGHT) {
		return;
	}
	const from = Math.max(0, left);
	const to = Math.min(FRAME_WIDTH - 1, right);
	if (from <= to) {
		pixels.fill(color, y * FRAME_WIDTH + from, y * FRAME_WIDTH + to + 1);
	}
}

function inFrame(x, y) {
	return x >= 0 && x < FRAME_WIDTH && y >= 0 && y < FRAME_HEIGHT;
}
