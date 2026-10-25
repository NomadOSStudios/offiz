export class History {
  constructor(state, limit = 100) {
    this.limit = limit;
    this.entries = [JSON.stringify(state)];
    this.index = 0;
  }
  record(state) {
    const next = JSON.stringify(state);
    if (next === this.entries[this.index]) return false;
    this.entries.splice(this.index + 1);
    this.entries.push(next);
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1;
    return true;
  }
  get canUndo() {
    return this.index > 0;
  }
  get canRedo() {
    return this.index < this.entries.length - 1;
  }
  undo() {
    return this.canUndo ? JSON.parse(this.entries[--this.index]) : null;
  }
  redo() {
    return this.canRedo ? JSON.parse(this.entries[++this.index]) : null;
  }
}
