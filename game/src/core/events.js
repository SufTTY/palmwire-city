// A tiny publish/subscribe bus so systems can react to each other (a ped dies -> wanted level,
// mission counters, panic) without importing each other.

export class EventBus {
  constructor() {
    this.handlers = new Map();
  }
  on(name, fn) {
    if (!this.handlers.has(name)) this.handlers.set(name, []);
    this.handlers.get(name).push(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) {
    const list = this.handlers.get(name);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  emit(name, data) {
    const list = this.handlers.get(name);
    if (!list) return;
    for (const fn of list.slice()) fn(data);
  }
}
