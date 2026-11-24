// Shared by the detail and edit entries; this waits for SDK initialization only.
// Authentication and Firestore access checks remain with their existing callers.
export async function waitForFirestoreReady(timeoutMs = 5000) {
  const startedAt = Date.now();
  while (!window.db) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("FIRESTORE_NOT_READY");
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
