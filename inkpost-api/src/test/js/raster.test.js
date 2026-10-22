import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	BLACK,
	blank,
	cellLine,
	cellOf,
	CLEAR,
	ellipse,
	floodFill,
	line,
	rectangle,
	shift,
	stamp,
	WHITE,
} from "../../main/resources/static/js/raster.js";

const WIDTH = 800;
const HEIGHT = 480;
const SYMBOLS = { [CLEAR]: ".", [BLACK]: "#", [WHITE]: "o" };

/** Rows of a part of the layer, one character per pixel: "." clear, "#" black, "o" white. */
function picture(pixels, left, top, width, height) {
	const rows = [];
	for (let y = top; y < top + height; y++) {
		let row = "";
		for (let x = left; x < left + width; x++) {
			row += SYMBOLS[pixels[y * WIDTH + x]];
		}
		rows.push(row);
	}
	return rows;
}

const count = (pixels, color) => pixels.filter((value) => value === color).length;

describe("the brush", () => {
	test("is one pixel at size 1", () => {
		const pixels = blank();
		stamp(pixels, 2, 1, 1, BLACK);

		assert.deepEqual(picture(pixels, 0, 0, 4, 3), ["....", "..#.", "...."]);
	});

	test("is a square centered on the point, one more to the right and down when even", () => {
		const pixels = blank();
		stamp(pixels, 2, 2, 4, BLACK);

		assert.deepEqual(picture(pixels, 0, 0, 6, 6), ["......", ".####.", ".####.", ".####.", ".####.", "......"]);
	});

	test("leaves out what's past the frame's edges", () => {
		const pixels = blank();
		stamp(pixels, 0, 0, 4, BLACK);
		stamp(pixels, WIDTH - 1, HEIGHT - 1, 4, WHITE);

		assert.equal(count(pixels, BLACK), 9);
		assert.equal(count(pixels, WHITE), 4);
	});
});

describe("a line", () => {
	test("goes from one point to the other, both included, with no gaps", () => {
		const pixels = blank();
		line(pixels, { x: 0, y: 0 }, { x: 5, y: 2 }, 1, BLACK);

		assert.deepEqual(picture(pixels, 0, 0, 6, 3), ["##....", "..##..", "....##"]);
	});

	test("is the same either way", () => {
		const forth = blank();
		const back = blank();
		line(forth, { x: 3, y: 10 }, { x: 40, y: 2 }, 1, BLACK);
		line(back, { x: 40, y: 2 }, { x: 3, y: 10 }, 1, BLACK);

		assert.deepEqual(forth, back);
		assert.equal(count(forth, BLACK), 38);
	});

	test("is a single stamp between the same point", () => {
		const pixels = blank();
		line(pixels, { x: 5, y: 5 }, { x: 5, y: 5 }, 2, WHITE);

		assert.equal(count(pixels, WHITE), 4);
	});

	test("is as thick as the brush", () => {
		const pixels = blank();
		line(pixels, { x: 1, y: 1 }, { x: 6, y: 1 }, 2, BLACK);

		assert.deepEqual(picture(pixels, 0, 0, 9, 4), [".........", ".#######.", ".#######.", "........."]);
	});

	test("starting outside the frame draws the part inside", () => {
		const pixels = blank();
		line(pixels, { x: -10, y: 3 }, { x: 4, y: 3 }, 1, BLACK);

		assert.equal(count(pixels, BLACK), 5);
	});
});

describe("the grid", () => {
	test("puts a point in the cell it's in, counting from the frame's corner", () => {
		assert.deepEqual(cellOf({ x: 25, y: 9 }, 10), { x: 2, y: 0 });
		assert.deepEqual(cellOf({ x: 799, y: 479 }, 10), { x: 79, y: 47 });
		assert.deepEqual(cellOf({ x: -1, y: 480 }, 10), { x: -1, y: 48 });
	});

	test("fills a whole cell", () => {
		const pixels = blank();
		cellLine(pixels, { x: 1, y: 1 }, { x: 1, y: 1 }, 2, BLACK);

		assert.deepEqual(picture(pixels, 0, 0, 5, 5), [".....", ".....", "..##.", "..##.", "....."]);
	});

	test("fills every cell on the way, so a fast drag skips none", () => {
		const pixels = blank();
		cellLine(pixels, { x: 0, y: 0 }, { x: 3, y: 1 }, 2, BLACK);

		assert.deepEqual(picture(pixels, 0, 0, 8, 4), ["####....", "####....", "....####", "....####"]);
	});

	test("fills a diagonal corner to corner", () => {
		const pixels = blank();
		cellLine(pixels, { x: 2, y: 2 }, { x: 0, y: 0 }, 1, WHITE);

		assert.deepEqual(picture(pixels, 0, 0, 3, 3), ["o..", ".o.", "..o"]);
	});

	test("fills the cells at the frame's edges, and nothing outside", () => {
		const pixels = blank();
		cellLine(pixels, { x: -1, y: 0 }, { x: -1, y: 0 }, 10, BLACK);
		assert.equal(count(pixels, BLACK), 0);

		cellLine(pixels, { x: 79, y: 47 }, { x: 80, y: 47 }, 10, BLACK);
		assert.equal(count(pixels, BLACK), 100);
		assert.equal(pixels[WIDTH * HEIGHT - 1], BLACK);
	});
});

describe("a rectangle", () => {
	test("has a border inside its corners, both included", () => {
		const pixels = blank();
		rectangle(pixels, { x: 1, y: 1 }, { x: 5, y: 4 }, { color: BLACK, border: 1, fill: null });

		assert.deepEqual(picture(pixels, 0, 0, 7, 6), [
			".......",
			".#####.",
			".#...#.",
			".#...#.",
			".#####.",
			".......",
		]);
	});

	test("is the same from any two opposite corners", () => {
		const options = { color: BLACK, border: 2, fill: WHITE };
		const expected = blank();
		rectangle(expected, { x: 10, y: 10 }, { x: 30, y: 20 }, options);
		for (const [from, to] of [
			[{ x: 30, y: 20 }, { x: 10, y: 10 }],
			[{ x: 10, y: 20 }, { x: 30, y: 10 }],
			[{ x: 30, y: 10 }, { x: 10, y: 20 }],
		]) {
			const pixels = blank();
			rectangle(pixels, from, to, options);
			assert.deepEqual(pixels, expected);
		}
	});

	test("fills inside the border", () => {
		const pixels = blank();
		rectangle(pixels, { x: 0, y: 0 }, { x: 5, y: 5 }, { color: BLACK, border: 2, fill: WHITE });

		assert.deepEqual(picture(pixels, 0, 0, 6, 6), ["######", "######", "##oo##", "##oo##", "######", "######"]);
	});

	test("with no border is only its fill", () => {
		const pixels = blank();
		rectangle(pixels, { x: 0, y: 0 }, { x: 2, y: 1 }, { color: BLACK, border: 0, fill: WHITE });

		assert.deepEqual(picture(pixels, 0, 0, 4, 3), ["ooo.", "ooo.", "...."]);
	});

	test("is solid when the border is thicker than half of it", () => {
		const pixels = blank();
		rectangle(pixels, { x: 0, y: 0 }, { x: 3, y: 3 }, { color: BLACK, border: 3, fill: WHITE });

		assert.equal(count(pixels, BLACK), 16);
		assert.equal(count(pixels, WHITE), 0);
	});

	test("leaves out what's past the frame's edges", () => {
		const pixels = blank();
		rectangle(pixels, { x: -5, y: -5 }, { x: 4, y: 4 }, { color: BLACK, border: 1, fill: null });

		assert.deepEqual(picture(pixels, 0, 0, 6, 6), [
			"....#.",
			"....#.",
			"....#.",
			"....#.",
			"#####.",
			"......",
		]);
	});
});

describe("an ellipse", () => {
	test("touches the four sides of its box", () => {
		const pixels = blank();
		ellipse(pixels, { x: 0, y: 0 }, { x: 6, y: 6 }, { color: BLACK, border: 1, fill: null });

		assert.deepEqual(picture(pixels, 0, 0, 7, 7), [
			"..###..",
			".#...#.",
			"#.....#",
			"#.....#",
			"#.....#",
			".#...#.",
			"..###..",
		]);
	});

	test("is the same from any two opposite corners", () => {
		const options = { color: WHITE, border: 3, fill: BLACK };
		const expected = blank();
		ellipse(expected, { x: 100, y: 50 }, { x: 160, y: 90 }, options);
		const pixels = blank();
		ellipse(pixels, { x: 160, y: 50 }, { x: 100, y: 90 }, options);

		assert.deepEqual(pixels, expected);
	});

	test("is symmetric", () => {
		const pixels = blank();
		ellipse(pixels, { x: 0, y: 0 }, { x: 40, y: 20 }, { color: BLACK, border: 2, fill: WHITE });
		const rows = picture(pixels, 0, 0, 41, 21);

		assert.deepEqual(rows, rows.toReversed());
		assert.deepEqual(rows, rows.map((row) => [...row].reverse().join("")));
	});

	test("fills inside the border, and the border goes all the way round", () => {
		const pixels = blank();
		ellipse(pixels, { x: 0, y: 0 }, { x: 59, y: 39 }, { color: BLACK, border: 1, fill: WHITE });
		const rows = picture(pixels, 0, 0, 60, 40);

		// Every row and every column starts and ends with the border.
		for (const row of rows) {
			assert.match(row, /^\.*#[#o]*#\.*$/);
		}
		for (let x = 0; x < 60; x++) {
			assert.match(rows.map((row) => row[x]).join(""), /^\.*#[#o]*#\.*$/);
		}
		assert.equal(pixels[20 * WIDTH + 30], WHITE);
	});

	test("with no border and no fill draws nothing", () => {
		const pixels = blank();
		ellipse(pixels, { x: 0, y: 0 }, { x: 20, y: 20 }, { color: BLACK, border: 0, fill: null });

		assert.equal(count(pixels, CLEAR), WIDTH * HEIGHT);
	});

	test("one pixel wide is a vertical line", () => {
		const pixels = blank();
		ellipse(pixels, { x: 2, y: 0 }, { x: 2, y: 3 }, { color: BLACK, border: 1, fill: null });

		assert.deepEqual(picture(pixels, 0, 0, 5, 4), ["..#..", "..#..", "..#..", "..#.."]);
	});
});

describe("the fill", () => {
	test("fills the area of the same value inside a border", () => {
		const pixels = blank();
		rectangle(pixels, { x: 0, y: 0 }, { x: 4, y: 4 }, { color: BLACK, border: 1, fill: null });

		assert.equal(floodFill(pixels, 2, 2, WHITE), true);
		assert.deepEqual(picture(pixels, 0, 0, 6, 6), [
			"#####.",
			"#ooo#.",
			"#ooo#.",
			"#ooo#.",
			"#####.",
			"......",
		]);
	});

	test("doesn't go through a diagonal gap", () => {
		const pixels = blank();
		line(pixels, { x: 0, y: 3 }, { x: 3, y: 0 }, 1, BLACK);
		floodFill(pixels, 0, 0, WHITE);

		assert.deepEqual(picture(pixels, 0, 0, 5, 5), ["ooo#.", "oo#..", "o#...", "#....", "....."]);
	});

	test("fills the whole clear layer, edges included", () => {
		const pixels = blank();
		floodFill(pixels, 400, 240, BLACK);

		assert.equal(count(pixels, BLACK), WIDTH * HEIGHT);
	});

	test("changes nothing on a pixel of the same value, or outside the frame", () => {
		const pixels = blank();
		stamp(pixels, 10, 10, 1, BLACK);

		assert.equal(floodFill(pixels, 10, 10, BLACK), false);
		assert.equal(floodFill(pixels, -1, 10, BLACK), false);
		assert.equal(floodFill(pixels, 10, HEIGHT, BLACK), false);
		assert.equal(count(pixels, BLACK), 1);
	});

	test("can make an area clear again", () => {
		const pixels = blank();
		rectangle(pixels, { x: 0, y: 0 }, { x: 9, y: 9 }, { color: BLACK, border: 0, fill: BLACK });
		floodFill(pixels, 5, 5, CLEAR);

		assert.equal(count(pixels, CLEAR), WIDTH * HEIGHT);
	});
});

describe("moving a layer", () => {
	test("moves every pixel, and leaves clear what it uncovers", () => {
		const pixels = blank();
		stamp(pixels, 1, 1, 1, BLACK);
		stamp(pixels, 2, 1, 1, WHITE);
		const moved = shift(pixels, 2, 1);

		assert.deepEqual(picture(moved, 0, 0, 6, 3), ["......", "......", "...#o."]);
		assert.equal(count(pixels, BLACK), 1, "the original is untouched");
	});

	test("loses what goes past the edges", () => {
		const pixels = blank();
		stamp(pixels, 0, 0, 1, BLACK);
		stamp(pixels, WIDTH - 1, HEIGHT - 1, 1, WHITE);

		assert.equal(count(shift(pixels, -1, 0), BLACK), 0);
		assert.equal(count(shift(pixels, 1, 1), WHITE), 0);
		assert.equal(shift(pixels, 1, 1)[WIDTH + 1], BLACK);
		assert.equal(shift(pixels, -WIDTH + 1, -HEIGHT + 1)[0], WHITE);
	});

	test("past the whole frame leaves it clear", () => {
		const pixels = blank().fill(BLACK);

		assert.equal(count(shift(pixels, WIDTH, 0), CLEAR), WIDTH * HEIGHT);
		assert.equal(count(shift(pixels, 0, -HEIGHT - 5), CLEAR), WIDTH * HEIGHT);
	});
});
