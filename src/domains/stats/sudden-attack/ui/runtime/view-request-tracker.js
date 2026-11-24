// Network requests may finish and fill their caches after the user leaves a view.
// Only the current view's request is allowed to update its UI.
export function createViewRequestTracker() {
  let version = 0;
  const capture = () => {
    const requestVersion = version;
    return () => requestVersion === version;
  };
  return {
    capture,
    start() {
      version += 1;
      return capture();
    },
    invalidate() { version += 1; }
  };
}
