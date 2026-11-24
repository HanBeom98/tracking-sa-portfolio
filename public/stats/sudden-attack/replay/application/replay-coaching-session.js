import { validateReplayCoachingResponse } from '../domain/replay-coaching-response.js?v=93e05adb5ab1';
const MAX_SESSION_RECORDS = 210;

export { isLocalCoachingTest } from '../domain/replay-local-mode.js?v=761b6d62adab';

// Memory only: keep the same ID for an account/evidence pair after an ambiguous
// response, file replacement or logout. Never infer cancellation at the server.
export function createReplayCoachingSession({ getUser, send, uuid, now = Date.now, onChange = () => {} }) {
  const sessions = new Map();
  let evidence = null, current = null, userId = null, revision = 0, abort = null;
  const uid = () => getUser()?.uid || null;
  const key = () => JSON.stringify([uid(), evidence]);
  function invalidate() {
    revision++;
    abort?.abort(); abort = null;
    if (current?.state === 'pending') current.state = 'unknown';
  }
  function view() {
    const user = uid();
    return { state: !evidence ? 'no_evidence' : !evidence.metrics ? 'insufficient' : !user ? 'signed_out'
      : current?.state || (sessions.size >= MAX_SESSION_RECORDS ? 'session_limit' : 'ready'),
      response: user && evidence ? current?.response : null, used: current?.used, error: current?.error };
  }
  function refresh() {
    invalidate(); userId = uid();
    current = userId && evidence ? sessions.get(key()) || null : null;
    onChange(view());
  }
  return {
    view,
    setEvidence(value) { invalidate(); evidence = value ? JSON.parse(JSON.stringify(value)) : null; refresh(); },
    authChanged() { if (uid() !== userId) refresh(); },
    async request() {
      if (uid() !== userId) refresh();
      if (!evidence?.metrics || !uid() || current?.state === 'pending' || current?.state === 'blocked') return;
      if (!current) {
        if (sessions.size >= MAX_SESSION_RECORDS) { onChange(view()); return; }
        const month = new Date(now() + 9 * 3600000).toISOString().slice(0, 7).replace('-', '');
        current = { requestId: `${month}-${uuid()}`, state: 'ready', evidence };
        sessions.set(key(), current);
      }
      const record = current, user = getUser(), turn = ++revision;
      record.state = 'pending'; record.error = null;
      abort = new AbortController(); const signal = abort.signal;
      const isCurrent = () => turn === revision && uid() === user.uid;
      onChange(view());
      try {
        const token = await user.getIdToken();
        if (!isCurrent()) return;
        const result = await send({ requestId: record.requestId, evidence: record.evidence }, token, signal);
        if (!isCurrent()) return;
        const body = result.body;
        if (result.status !== 200) {
          record.error = typeof body?.error === 'string' ? body.error : 'INVALID_RESPONSE';
          // These outcomes cannot be fixed by retrying this request in the UI.
          record.state = [403, 422, 429].includes(result.status)
            || ['INVALID_REQUEST_ID', 'IDEMPOTENCY_CONFLICT', 'PREVIOUS_ATTEMPT_FAILED', 'MOCK_RESPONSE_FAILED', 'ACCESS_PERIOD_CONFLICT'].includes(record.error)
            ? 'blocked' : 'unknown';
        } else {
          if (body?.mode !== 'mock' || body.requestId !== record.requestId || !Number.isInteger(body.used) || body.used < 0
            || !['completed', 'already_completed'].includes(body.outcome)) throw new Error('INVALID_RESPONSE');
          if (body.outcome === 'completed') {
            try { record.response = validateReplayCoachingResponse(body.response, record.evidence); }
            catch { throw new Error('INVALID_RESPONSE'); }
          }
          record.used = body.used;
          record.state = body.outcome === 'already_completed' ? 'already_completed' : 'completed';
        }
      } catch (error) {
        if (!isCurrent()) return;
        record.error = error.message === 'INVALID_RESPONSE' ? 'INVALID_RESPONSE' : 'CONNECTION_UNKNOWN';
        record.state = 'unknown';
      } finally {
        if (isCurrent()) { abort = null; onChange(view()); }
        else if (turn === revision) refresh();
      }
    },
  };
}
