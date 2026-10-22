// Text boxes (D50), with no DOM: words wrapped to a box's width, and the box drawn, hit and resized. Boxes are
// { left, top, width, height } in whole frame pixels.

/** The three sizes (D22), in pixels: small, medium, large. */
export const TEXT_SIZES = Object.freeze({ small: 24, medium: 40, large: 64 });

/** The smallest a box gets, either way, in pixels. */
export const MIN_BOX = 16;

/**
 * The lines of a text in a box `width` wide, with `measure(string)` the width of a string. Words wrap at
 * spaces, and the space at a break is dropped; a word wider than the box is cut where it must. A new line
 * in the text is a new line, an empty one too.
 */
export function wrap(text, width, measure) {
	const lines = [];
	for (const paragraph of text.split("\n")) {
		let line = null;
		for (const word of paragraph.split(" ")) {
			const longer = line === null ? word : `${line} ${word}`;
			if (line === null || measure(longer) <= width) {
				line = longer;
			} else {
				lines.push(line);
				line = word;
			}
			while (line.length > 1 && measure(line) > width) {
				const cut = fitting(line, width, measure);
				lines.push(line.slice(0, cut));
				line = line.slice(cut);
			}
		}
		lines.push(line);
	}
	return lines;
}

/** How many characters from the start fit in the width, at least one. */
function fitting(line, width, measure) {
	let count = 1;
	while (count < line.length && measure(line.slice(0, count + 1)) <= width) {
		count++;
	}
	return count;
}

/** Where a line starts in its box, in whole pixels: "left", "center" or "right". */
export function lineX(lineWidth, boxWidth, align) {
	if (align === "center") {
		return Math.floor((boxWidth - lineWidth) / 2);
	}
	return align === "right" ? Math.floor(boxWidth - lineWidth) : 0;
}

/** The box between two opposite corner pixels, whichever they are, both included. */
export function boxBetween(from, to) {
	const left = Math.min(from.x, to.x);
	const top = Math.min(from.y, to.y);
	return { left, top, width: Math.abs(to.x - from.x) + 1, height: Math.abs(to.y - from.y) + 1 };
}

export function inBox(box, point) {
	return (
		point.x >= box.left && point.x < box.left + box.width && point.y >= box.top && point.y < box.top + box.height
	);
}

/**
 * The box with the edges a handle holds moved by (dx, dy): "n", "s", "e", "w", or a corner like "nw". An edge
 * stops MIN_BOX away from the opposite one.
 */
export function resizeBox(box, handle, dx, dy) {
	let left = box.left;
	let top = box.top;
	let right = box.left + box.width;
	let bottom = box.top + box.height;
	if (handle.includes("w")) {
		left = Math.min(left + dx, right - MIN_BOX);
	}
	if (handle.includes("e")) {
		right = Math.max(right + dx, left + MIN_BOX);
	}
	if (handle.includes("n")) {
		top = Math.min(top + dy, bottom - MIN_BOX);
	}
	if (handle.includes("s")) {
		bottom = Math.max(bottom + dy, top + MIN_BOX);
	}
	return { left, top, width: right - left, height: bottom - top };
}
