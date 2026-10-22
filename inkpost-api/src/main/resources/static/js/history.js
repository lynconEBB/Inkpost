// Undo and redo (D49), with no DOM: every step is a whole state, the editor's layer list. Layers are never
// changed in place, so a step only costs what changed in it.

export class History {
	#past = [];
	#future = [];
	#limit;

	/** `current` is where undo stops; at most `limit` steps back are kept. */
	constructor(current, limit = 50) {
		this.current = current;
		this.#limit = limit;
	}

	get canUndo() {
		return this.#past.length > 0;
	}

	get canRedo() {
		return this.#future.length > 0;
	}

	/** A new step: the oldest is dropped past the limit, and nothing is left to redo. */
	push(state) {
		this.#past.push(this.current);
		if (this.#past.length > this.#limit) {
			this.#past.shift();
		}
		this.#future = [];
		this.current = state;
	}

	/** Returns the state one step back, or the same one when there's none. */
	undo() {
		if (this.canUndo) {
			this.#future.push(this.current);
			this.current = this.#past.pop();
		}
		return this.current;
	}

	redo() {
		if (this.canRedo) {
			this.#past.push(this.current);
			this.current = this.#future.pop();
		}
		return this.current;
	}
}
