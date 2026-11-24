// Cloudflare's existing data-center cache survives individual Worker instances.
// Other runtimes keep using the handlers' in-memory cache without a binding.
function edgeCache() {
  return globalThis.caches?.default;
}

export async function publicCacheKey(requestUrl, service, params = {}) {
  if (!edgeCache() || !requestUrl) return null;
  try {
    // Provider identifiers and player query values must not appear in cache URLs.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(params)));
    const url = new URL(`/__tracking_sa_cache/v1/${service}`, requestUrl);
    url.searchParams.set('key', Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''));
    return url.toString();
  } catch {
    return null;
  }
}

export async function readPublicResponse(key, cacheHeader) {
  if (!key) return null;
  try {
    const cached = await edgeCache().match(key);
    if (!cached) return null;
    const response = new Response(cached.body, cached);
    response.headers.set(cacheHeader, 'EDGE_HIT');
    return response;
  } catch {
    return null; // Cache availability must not turn a working provider into an error.
  }
}

export async function storePublicResponse(context, key, response) {
  if (!key || response.status !== 200 || response.headers.has('set-cookie')) return;
  const policy = response.headers.get('cache-control') || '';
  if (!/\bpublic\b/i.test(policy) || /\b(?:private|no-store)\b/i.test(policy)
    || !/\bs-maxage=[1-9]\d*\b/i.test(policy)) return;
  const write = Promise.resolve().then(() => edgeCache().put(key, response.clone())).catch(() => {});
  if (context.waitUntil) context.waitUntil(write);
  else await write;
}
