// Admin-only migration. Never print documents, emails, credentials or tokens.
import { createHash, sign } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const MIGRATION = 'board-privacy-v1';
const validNickname = (value) => typeof value === 'string' && /^[A-Za-z0-9가-힣_]{2,12}$/.test(value);
const stringField = (document, key) => document?.fields?.[key]?.stringValue || '';
const emailName = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+$/.test(value.trim());
const digest = (value) => createHash('sha256').update(value).digest('hex');

export function createPrivacyClient({ projectId, token, emulatorHost, fetchImpl = fetch }) {
  if (emulatorHost && (!projectId.startsWith('demo-') || !/^(127\.0\.0\.1|localhost):\d+$/.test(emulatorHost))) {
    throw new Error('Emulator requires a local host and demo project');
  }
  if (!/^[a-z0-9-]+$/.test(projectId)) throw new Error('Invalid project');
  const database = `projects/${projectId}/databases/(default)`;
  const base = `${emulatorHost ? `http://${emulatorHost}` : 'https://firestore.googleapis.com'}/v1/${database}`;
  async function request(path, options = {}) {
    const response = await fetchImpl(`${base}/${path}`, {
      ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404 && !options.method) return null;
    if (!response.ok) throw Object.assign(new Error(`Firestore request failed (${response.status})`), { code: `http-${response.status}` });
    return response.json();
  }
  return {
    database,
    async *list(path) {
      let pageToken = '';
      do {
        const query = new URLSearchParams({ pageSize: '100', showMissing: 'true', ...(pageToken ? { pageToken } : {}) });
        const result = await request(`documents/${path}?${query}`);
        for (const document of result?.documents || []) yield document;
        pageToken = result?.nextPageToken || '';
      } while (pageToken);
    },
    get: (path) => request(`documents/${path}`),
    commit: (writes) => request('documents:commit', { method: 'POST', body: JSON.stringify({ writes }) }),
  };
}

export async function migrateBoardPrivacy({ client, apply = false }) {
  const report = { mode: apply ? 'apply' : 'audit', postsScanned: 0, commentsScanned: 0, emailFields: 0, emailNames: 0, planned: 0, applied: 0 };
  const profileNames = new Map();
  async function publicName(document) {
    const uid = stringField(document, 'authorUid');
    if (uid && !uid.includes('/')) {
      if (!profileNames.has(uid)) {
        const profile = await client.get(`users/${encodeURIComponent(uid)}`);
        const nickname = stringField(profile, 'nickname');
        profileNames.set(uid, validNickname(nickname) ? nickname : '');
      }
      if (profileNames.get(uid)) return profileNames.get(uid);
    }
    // Historical content remains attributable to the same account without
    // inventing a registered nickname or exposing an email address.
    return `미설정회원_${digest(uid || document.name).slice(0, 12)}`;
  }
  async function clean(document) {
    if (!document.fields) return;
    const prefix = `${client.database}/documents/`;
    if (!document.name?.startsWith(prefix) || !/^board_posts\/[^/]+(?:\/comments\/[^/]+)?$/.test(document.name.slice(prefix.length))) {
      throw new Error('Unexpected source document path');
    }
    const fields = document.fields;
    const hasEmail = Object.hasOwn(fields, 'authorEmail');
    const hasEmailName = emailName(stringField(document, 'authorName'));
    if (!hasEmail && !hasEmailName) return;
    if (hasEmail) report.emailFields++;
    if (hasEmailName) report.emailNames++;
    report.planned++;
    if (!apply) return;
    const changedFields = [...(hasEmail ? ['authorEmail'] : []), ...(hasEmailName ? ['authorName'] : [])];
    const nextFields = hasEmailName ? { authorName: { stringValue: await publicName(document) } } : {};
    const backupPath = `_board_privacy_backups/${MIGRATION}_${digest(document.name)}`;
    const backup = await client.get(backupPath);
    if (backup && (stringField(backup, 'migration') !== MIGRATION || backup.fields?.source?.referenceValue !== document.name)) {
      throw new Error('Unexpected backup document');
    }
    const writes = [];
    if (!backup) writes.push({
      update: { name: `${prefix}${backupPath}`, fields: {
        migration: { stringValue: MIGRATION }, source: { referenceValue: document.name },
        savedAt: { timestampValue: new Date().toISOString() },
        original: { mapValue: { fields: Object.fromEntries(changedFields.filter((key) => Object.hasOwn(fields, key)).map((key) => [key, fields[key]])) } },
      } }, currentDocument: { exists: false },
    });
    if (!document.updateTime) throw new Error('Missing source version');
    writes.push({ update: { name: document.name, fields: nextFields }, updateMask: { fieldPaths: changedFields }, currentDocument: { updateTime: document.updateTime } });
    // Backup and restricted-field update commit together. A concurrent edit
    // aborts both writes; rerun safely against the new document version.
    await client.commit(writes);
    report.applied++;
  }
  for await (const post of client.list('board_posts')) {
    if (post.fields) report.postsScanned++;
    await clean(post);
    const id = post.name.split('/').at(-1);
    for await (const comment of client.list(`board_posts/${encodeURIComponent(id)}/comments`)) {
      if (comment.fields) report.commentsScanned++;
      await clean(comment);
    }
  }
  return report;
}

async function accessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const assertion = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), credentials.private_key).toString('base64url')}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('Service-account authentication failed');
  const result = await response.json();
  if (!result.access_token) throw new Error('Missing service-account access token');
  return result.access_token;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
    if (credentials.project_id !== 'demo-tracking-sa-portfolio') throw new Error('Unexpected production project');
    if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Production entry point cannot target an emulator');
    const client = createPrivacyClient({ projectId: credentials.project_id, token: await accessToken(credentials) });
    console.log('Board privacy audit:', JSON.stringify(await migrateBoardPrivacy({ client })));
    if (process.argv.includes('--apply')) {
      console.log('Board privacy cleanup:', JSON.stringify(await migrateBoardPrivacy({ client, apply: true })));
      const remaining = await migrateBoardPrivacy({ client });
      console.log('Board privacy verification:', JSON.stringify(remaining));
      if (remaining.planned) throw new Error('Privacy cleanup requires another pass');
    }
  } catch (error) {
    console.error('Board privacy migration stopped safely:', error.code || 'migration-failed');
    process.exitCode = 1;
  }
}
