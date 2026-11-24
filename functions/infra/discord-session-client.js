const SESSION_ENDPOINT = 'https://asia-northeast3-demo-tracking-sa-portfolio.cloudfunctions.net/discordMatchSession';

export async function requestDiscordSession(request, rawBody, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(SESSION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature-ed25519': request.headers.get('x-signature-ed25519'),
      'x-signature-timestamp': request.headers.get('x-signature-timestamp'),
    },
    body: rawBody,
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error('Discord session backend rejected request'), {
      code: result.error || 'SESSION_BACKEND_FAILED', status: response.status,
    });
  }
  return result;
}
