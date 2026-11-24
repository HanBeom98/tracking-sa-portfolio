const { createPublicKey, verify } = require('node:crypto');

const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;
const MAX_PARTICIPANTS = 20;
const MAX_RECENT_INTERACTIONS = 128;
const isId = (value) => typeof value === 'string' && /^[0-9]{1,32}$/.test(value);
function fail(code, status = 400) { throw Object.assign(new Error(code), { code, status }); }

function verifyDiscordRequest({ rawBody, headers, publicKey, nowMs }) {
  const signature = headers['x-signature-ed25519'];
  const timestamp = headers['x-signature-timestamp'];
  if (!Buffer.isBuffer(rawBody) || rawBody.length > 65536
    || !/^[0-9a-f]{128}$/i.test(signature || '') || !/^[0-9]{1,12}$/.test(timestamp || '')
    || Math.abs(nowMs - Number(timestamp) * 1000) > SIGNATURE_MAX_AGE_MS) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'hex')]),
      format: 'der', type: 'spki',
    });
    return verify(null, Buffer.concat([Buffer.from(timestamp), rawBody]), key, Buffer.from(signature, 'hex'));
  } catch { return false; }
}

function transitionSession(current, interaction, nowMs) {
  const uid = interaction.member?.user?.id || interaction.user?.id;
  if (!isId(uid) || !isId(interaction.guild_id) || !isId(interaction.id)) fail('INVALID_CONTEXT');
  const recent = (Array.isArray(current?._recentInteractions) ? current._recentInteractions : [])
    .filter((item) => isId(item?.id) && Number.isFinite(item.at) && item.at > nowMs - SIGNATURE_MAX_AGE_MS && item.at <= nowMs);
  if (recent.some((item) => item.id === interaction.id)) return { code: 'DUPLICATE', changed: false, session: current };
  if (recent.length >= MAX_RECENT_INTERACTIONS) fail('TOO_MANY_REQUESTS', 429);

  const remember = (code, session, changed) => ({
    code, changed, persist: true,
    session: { ...session, _recentInteractions: [...recent, { id: interaction.id, at: nowMs }] },
  });
  let session;
  if (interaction.type === 2 && interaction.data?.name === '대내모집') {
    if (current?.status === 'RECRUITING' && current.hostId !== uid) fail('HOST_REQUIRED', 403);
    session = { status: 'RECRUITING', participants: [], hostId: uid, createdAt: new Date(nowMs).toISOString(), lastRefreshedAt: 0 };
  } else {
    if (interaction.type !== 3) fail('UNSUPPORTED_ACTION');
    if (!current || current.status !== 'RECRUITING') return { code: 'INACTIVE', changed: false, session: null };
    if (!isId(current.hostId) || !Array.isArray(current.participants) || current.participants.length > MAX_PARTICIPANTS
      || current.participants.some((p) => !isId(p?.discordId) || typeof p.nickname !== 'string'
        || !['rifler', 'sniper'].includes(p.position))) fail('INVALID_SESSION', 409);
    session = { status: current.status, participants: current.participants.map((p) => ({ ...p })),
      hostId: current.hostId, createdAt: current.createdAt, lastRefreshedAt: Number(current.lastRefreshedAt || 0) };
    const action = interaction.data?.custom_id || '';
    if (action === 'refresh_list') {
      if (nowMs - session.lastRefreshedAt < 10000) return remember('THROTTLED', session, false);
      session.lastRefreshedAt = nowMs;
    } else if (action === 'leave_match') {
      session.participants = session.participants.filter((p) => p.discordId !== uid);
    } else if (action.startsWith('set_pos_')) {
      const match = /^set_pos_(rifler|sniper)_([^\r\n\u0000-\u001f]{2,16})$/.exec(action);
      if (!match) fail('INVALID_PARTICIPANT');
      if (session.participants.some((p) => p.discordId === uid)) return remember('ALREADY_JOINED', session, false);
      if (session.participants.length >= MAX_PARTICIPANTS) fail('SESSION_FULL', 409);
      session.participants.push({ nickname: match[2], discordId: uid, position: match[1] });
    } else if (action === 'cancel_match' || action === 'start_balance') {
      if (session.hostId !== uid) fail('HOST_REQUIRED', 403);
      if (action === 'start_balance' && session.participants.length < 10) return remember('NOT_READY', session, false);
      session.status = action === 'cancel_match' ? 'CANCELLED' : 'CLOSED';
    } else fail('UNSUPPORTED_ACTION');
  }
  // Bound replay protection to the signature validity window, without a growing log collection.
  return remember('UPDATED', session, true);
}

function createDiscordSessionHandler({ db, publicKey, applicationId, now = Date.now, logError = console.error }) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    const nowMs = now();
    if (!verifyDiscordRequest({ rawBody: req.rawBody, headers: req.headers, publicKey, nowMs })) {
      return res.status(401).json({ error: 'INVALID_SIGNATURE' });
    }
    let interaction;
    try { interaction = JSON.parse(req.rawBody.toString('utf8')); } catch { return res.status(400).json({ error: 'INVALID_JSON' }); }
    if (interaction.application_id !== applicationId) return res.status(403).json({ error: 'WRONG_APPLICATION' });
    if (!isId(interaction.guild_id) || !isId(interaction.id)) return res.status(400).json({ error: 'INVALID_CONTEXT' });
    try {
      const sessionRef = db.collection('match_sessions').doc(interaction.guild_id);
      const result = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(sessionRef);
        const updated = transitionSession(snapshot.exists ? snapshot.data() : null, interaction, nowMs);
        if (updated.persist) transaction.set(sessionRef, updated.session);
        return updated;
      });
      return res.status(200).json(result);
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.code });
      // Never log the signed body, interaction token or authorization headers.
      logError('Discord session transaction failed', { code: error.code || 'UNKNOWN' });
      return res.status(503).json({ error: 'SESSION_STORAGE_UNAVAILABLE' });
    }
  };
}

module.exports = { createDiscordSessionHandler, transitionSession, verifyDiscordRequest };
