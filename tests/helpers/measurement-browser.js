export function measurementBrowser() {
  let time = 0, nextId = 0;
  const frames = new Map(), timers = new Map(), listeners = new Map(), observers = [];
  const document = { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set('doc:' + name, fn) };
  const window = {
    performance: { now: () => time },
    addEventListener: (name, fn) => listeners.set(name, fn),
    requestAnimationFrame: fn => { const id = ++nextId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, ms) => { const id = ++nextId; timers.set(id, { fn, at: time + ms }); return id; },
    clearTimeout: id => timers.delete(id),
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
      observe(target) { this.targets.add(target); }
      unobserve(target) { this.targets.delete(target); }
      disconnect() { this.targets.clear(); }
    },
  };
  function advance(ms) {
    const end = time + ms;
    for (;;) {
      const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); time = due[1].at; due[1].fn();
    }
    time = end;
  }
  const frame = () => { advance(16); const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(time)); };
  return { window, document, listeners, observers, frames, timers, advance, frame,
    paint: () => { frame(); frame(); },
    visibility: (state) => { document.visibilityState = state; listeners.get('doc:visibilitychange')?.(); },
    dispatch: name => listeners.get(name)?.(),
    intersect(target, ratio) {
      for (const observer of observers) if (observer.targets.has(target)) {
        observer.callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
      }
    },
  };
}
