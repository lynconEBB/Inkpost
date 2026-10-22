import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { History } from "../../main/resources/static/js/history.js";

describe("the history", () => {
	test("starts with nothing to undo or redo", () => {
		const history = new History("a");

		assert.equal(history.current, "a");
		assert.equal(history.canUndo, false);
		assert.equal(history.canRedo, false);
		assert.equal(history.undo(), "a");
		assert.equal(history.redo(), "a");
	});

	test("undoes and redoes step by step", () => {
		const history = new History("a");
		history.push("b");
		history.push("c");

		assert.equal(history.undo(), "b");
		assert.equal(history.undo(), "a");
		assert.equal(history.canUndo, false);
		assert.equal(history.redo(), "b");
		assert.equal(history.redo(), "c");
		assert.equal(history.canRedo, false);
		assert.equal(history.current, "c");
	});

	test("forgets what could be redone when a new step is pushed", () => {
		const history = new History("a");
		history.push("b");
		history.undo();
		history.push("c");

		assert.equal(history.canRedo, false);
		assert.equal(history.undo(), "a");
	});

	test("keeps at most the limit of steps back", () => {
		const history = new History(0, 3);
		for (let step = 1; step <= 5; step++) {
			history.push(step);
		}

		assert.equal(history.undo(), 4);
		assert.equal(history.undo(), 3);
		assert.equal(history.undo(), 2);
		assert.equal(history.canUndo, false);
		assert.equal(history.undo(), 2);
	});
});
