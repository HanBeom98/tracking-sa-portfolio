(function (globalScope) {
  function createAuthStateBus({ onListenerError } = {}) {
    const listeners = new Set();
    let snapshot = { user: null, profile: null };

    return {
      subscribe(listener) {
        if (typeof listener !== "function") return () => {};
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      publish(nextState = {}) {
        snapshot = {
          user: nextState.user || null,
          profile: nextState.profile || null,
        };
        listeners.forEach((listener) => {
          try {
            listener(snapshot);
          } catch (error) {
            if (typeof onListenerError === "function") {
              onListenerError(error);
            }
          }
        });
      },
      getSnapshot() {
        return snapshot;
      },
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { createAuthStateBus };
  }

  if (globalScope && typeof globalScope === "object") {
    globalScope.createAuthStateBus = createAuthStateBus;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
