import { serializeReplayReviewBinding, validateReplayReviewEnvelope } from '../domain/replay-review-response.js';
const exact = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const LIMIT_ERRORS = new Set(['USER_LIMIT', 'ATTEMPT_LIMIT', 'GLOBAL_LIMIT', 'GLOBAL_BUDGET_LIMIT', 'USER_BUDGET_LIMIT', 'DAILY_USER_LIMIT', 'DAILY_ATTEMPT_LIMIT']);
const ACCESS_ERRORS = new Set(['AI_CREDITS_REQUIRED', 'CREDIT_ACCOUNT_BLOCKED']);
const IN_PROGRESS_ERRORS = new Set(['REQUEST_IN_PROGRESS', 'REQUEST_UNRESOLVED']);
const RETRY_BEFORE_GENERATION = new Map([
  ['UNAUTHENTICATED', 401], ['AI_CREDITS_REQUIRED', 403], ['CREDIT_ACCOUNT_BLOCKED', 403], ['CREDITS_EXHAUSTED', 429],
  ...[...LIMIT_ERRORS].map(code => [code, 429]), ['COACHING_DISABLED', 503], ['COACHING_NOT_CONFIGURED', 503],
  ['COACHING_STOPPED', 503], ['TOKEN_COUNT_UNAVAILABLE', 503], ['INPUT_TOKEN_LIMIT', 422],
]);

// The shared map retains only account/evidence/request IDs for this page's life.
// Ambiguous outcomes only allow lookup. An explicit pre-generation rejection
// may be manually retried with the SAME ID after a purchase/login/limit change.
export function createReplayReviewApiSession(review, { getUser, send, uuid, records = new Map(),
  now = Date.now, onChange = () => {} } = {}) {
  const evidence = JSON.parse(JSON.stringify(review)), binding = serializeReplayReviewBinding(evidence);
  let observedUid = getUser()?.uid || null, state = 'idle', response = null, credits = null;
  let revision = 0, disposed = false, abort = null;
  const uid = () => getUser()?.uid || null;
  const key = () => JSON.stringify([uid(), binding]);
  const record = () => uid() ? records.get(key()) : null;
  const view = () => {
    const signedIn = Boolean(uid()), current = uid() === observedUid, previous = record();
    const visible = !signedIn ? 'signed_out' : !evidence.candidates.length ? 'insufficient'
      : !current || state === 'idle' ? previous ? previous.generationAllowed ? 'retryable' : 'recoverable' : records.size >= 210 ? 'session_limit' : 'idle' : state;
    return { state: visible, response: current && signedIn ? response : null, credits: current && signedIn ? credits : null,
      canGenerate: signedIn && evidence.candidates.length > 0 && visible !== 'pending'
        && (previous ? previous.generationAllowed === true : ['idle', 'auth_required'].includes(visible)),
      canLookup: Boolean(previous) && visible !== 'pending' && signedIn };
  };
  const publish = () => { if (!disposed) onChange(view()); };
  function invalidate() { revision++; abort?.abort(); abort = null; response = null; credits = null; state = 'idle'; }
  function authChanged() {
    if (disposed || uid() === observedUid) return;
    invalidate(); observedUid = uid(); publish();
  }
  return {
    view, authChanged,
    dispose() { disposed = true; invalidate(); },
    async request(action = 'generate') {
      if (disposed || !['generate', 'result'].includes(action)) return;
      authChanged();
      const before = view();
      if (action === 'generate' ? !before.canGenerate : !before.canLookup) return;
      const user = getUser(), turn = ++revision;
      abort = new AbortController(); const signal = abort.signal;
      const current = () => !disposed && turn === revision && uid() === user.uid;
      response = null; credits = null; state = 'pending'; publish();
      try {
        const token = await user.getIdToken();
        if (!current()) return;
        let previous = record();
        if (previous && action === 'generate' && previous.generationAllowed !== true) action = 'result';
        if (!previous) {
          if (action !== 'generate' || records.size >= 210) throw new Error('SESSION_LIMIT');
          const month = new Date(now() + 9 * 3600000).toISOString().slice(0, 7).replace('-', '');
          const requestId = `${month}-${uuid()}`;
          if (!/^\d{6}-[A-Za-z0-9_-]{16,64}$/.test(requestId)) throw new Error('INVALID_REQUEST_ID');
          previous = { requestId, generationAllowed: true }; records.set(key(), previous);
        }
        if (action === 'generate') previous.generationAllowed = false;
        const result = await send({ action, requestId: previous.requestId, evidence }, token, signal);
        if (!current()) return;
        const body = result.body;
        if (result.status !== 200) {
          const code = exact(body, ['error']) && typeof body.error === 'string' ? body.error : '';
          if (action === 'generate' && RETRY_BEFORE_GENERATION.get(code) === result.status) previous.generationAllowed = true;
          state = result.status === 401 && code === 'UNAUTHENTICATED' ? 'auth_required'
            : result.status === 403 && ACCESS_ERRORS.has(code) ? 'credits_required'
            : result.status === 429 && code === 'CREDITS_EXHAUSTED' ? 'credits_empty'
            : result.status === 429 && LIMIT_ERRORS.has(code) ? 'limit'
            : result.status === 404 && code === 'COACHING_RESULT_NOT_FOUND' ? 'not_found'
            : result.status === 409 && IN_PROGRESS_ERRORS.has(code) ? 'processing'
            : result.status === 503 && code === 'COACHING_DISABLED' ? 'disabled'
            : action === 'generate' && previous.generationAllowed ? 'retryable' : 'unknown';
        } else {
          if (!exact(body, ['mode', 'requestId', 'outcome', 'credits', 'result']) || body.mode !== 'review'
            || body.requestId !== previous.requestId || !['completed', 'already_completed'].includes(body.outcome)
            || (action === 'result' && body.outcome !== 'already_completed')
            || !exact(body.credits, ['remaining', 'held']) || !Number.isSafeInteger(body.credits.remaining)
            || body.credits.remaining < 0 || body.credits.remaining > 10000 || ![0, 1].includes(body.credits.held)) throw new Error('INVALID_RESPONSE');
          const validated = await validateReplayReviewEnvelope(body.result, evidence);
          if (!current()) return;
          previous.generationAllowed = false;
          response = validated; credits = { ...body.credits }; state = 'ready';
        }
      } catch {
        if (!current()) return;
        state = record() ? 'unknown' : 'auth_required';
      } finally {
        if (current()) { abort = null; publish(); }
        else if (!disposed) authChanged();
      }
    },
  };
}
