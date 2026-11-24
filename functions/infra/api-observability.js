export function createApiTrace(service) {
  const startedAt = Date.now();
  const requestId = globalThis.crypto.randomUUID();
  return {
    finish(response, { code = 'OK', cache = 'NONE', partialFailures = 0 } = {}) {
      const durationMs = Math.max(0, Date.now() - startedAt);
      const event = { event: 'tracking_sa_api', service, requestId, status: response.status, code, cache, durationMs, partialFailures };
      try { console.info(JSON.stringify(event)); } catch { /* Preserve the API response. */ }
      const headers = new Headers(response.headers);
      if (response.status >= 400) headers.set('Cache-Control', 'no-store');
      headers.set('X-Request-ID', requestId);
      headers.set('Server-Timing', `app;dur=${durationMs}`);
      headers.set('Access-Control-Expose-Headers', 'X-Request-ID, Server-Timing, X-SA-Cache, X-SOOP-Cache');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    },
  };
}
