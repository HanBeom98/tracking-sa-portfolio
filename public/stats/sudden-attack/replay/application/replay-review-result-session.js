import { MAX_REVIEW_RESULT_BYTES, validateReplayReviewEnvelope } from '../domain/replay-review-response.js?v=36d2b814e024';

// Memory-only saved-response import. No transport, storage, quota or provider.
export function createReplayReviewResultSession(review, { onChange = () => {} } = {}) {
  const evidence = JSON.parse(JSON.stringify(review));
  let revision = 0, disposed = false, state = 'empty', response = null;
  const view = () => ({ state, response });
  const publish = () => { if (!disposed) onChange(view()); };
  return {
    view,
    clear() { if (disposed) return; revision++; state = 'empty'; response = null; publish(); },
    dispose() { revision++; disposed = true; response = null; },
    async load(file) {
      if (disposed) return;
      const current = ++revision;
      response = null; state = 'pending'; publish();
      try {
        if (!file || !Number.isInteger(file.size) || file.size < 1 || file.size > MAX_REVIEW_RESULT_BYTES
          || !/\.json$/i.test(file.name) || typeof file.text !== 'function') throw new Error('INVALID_REVIEW_RESULT');
        const text = await file.text();
        if (disposed || current !== revision) return;
        if (new TextEncoder().encode(text).byteLength > MAX_REVIEW_RESULT_BYTES) throw new Error('INVALID_REVIEW_RESULT');
        const result = await validateReplayReviewEnvelope(JSON.parse(text), evidence);
        if (disposed || current !== revision) return;
        response = result; state = 'ready';
      } catch (error) {
        if (disposed || current !== revision) return;
        response = null; state = error.message === 'REVIEW_EVIDENCE_MISMATCH' ? 'mismatch' : 'invalid';
      }
      publish();
    },
  };
}
