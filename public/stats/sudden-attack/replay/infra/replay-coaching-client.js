// Fixed same-origin loopback route. There is no production API URL or provider key.
export async function sendLocalReplayCoaching(body, token, signal) {
  const response = await fetch('/api/replay-coaching', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), cache: 'no-store', credentials: 'omit',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  return { status: response.status, body: await response.json() };
}
