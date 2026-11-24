import { MAX_SOOP_PAGES, getSoopPageCount, projectSoopPage, selectSoopBroadcasts } from '../../src/domains/home/soop-broadcasts.js';
export { extractSoopBroadcasts } from '../../src/domains/home/soop-broadcasts.js';
import { requestJson, withRequestDeadline, RequestFailure, requestFailureCode } from '../../src/domains/shared/http-request.js';
import { createApiTrace } from '../infra/api-observability.js';
import { publicCacheKey, readPublicResponse, storePublicResponse } from '../infra/public-response-cache.js';

const responseCache = new Map();
const CACHE_TTL_MS = 30 * 1000;
const STALE_TTL_MS = 5 * 60 * 1000;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=300',
      ...extraHeaders,
    },
  });
}

export function buildSoopBroadListUrl(env = {}, pageNo = 1) {
  const clientId = String(env.SOOP_CLIENT_ID || '').trim();
  const categoryId = String(env.SOOP_CATEGORY_ID || '').trim();
  if (!clientId || !categoryId) return '';

  const url = new URL('https://openapi.sooplive.com/broad/list');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('select_key', 'cate');
  url.searchParams.set('select_value', categoryId);
  url.searchParams.set('order_type', 'view_cnt');
  url.searchParams.set('page_no', String(Math.max(1, Number(pageNo) || 1)));
  return url.toString();
}

function pendingPayload() {
  return {
    status: 'pending',
    provider: 'SOOP',
    category: 'Sudden Attack',
    broadcasts: [],
    message: 'SOOP Developers 승인 후 라이브 방송을 연결합니다.',
  };
}

async function servePage(context, pageNo, respond) {
  const providerUrl = buildSoopBroadListUrl(context.env, pageNo);
  const cacheId = `page:${providerUrl}`;
  const now = Date.now();
  const cached = responseCache.get(cacheId);
  if (cached?.expiresAt > now) {
    return respond(jsonResponse(cached.body, 200, { 'X-SOOP-Cache': 'HIT' }), { cache: 'HIT' });
  }
  const edgeKey = await publicCacheKey(context.request.url, 'soop-live-page-v1', { provider: providerUrl });
  const edgeResponse = await readPublicResponse(edgeKey, 'X-SOOP-Cache');
  if (edgeResponse) return respond(edgeResponse, { cache: 'EDGE_HIT' });
  try {
    const { response: upstream, data } = await requestJson(providerUrl, {
      method: 'GET', headers: { Accept: 'application/json' },
    }, { timeoutMs: 10000 });
    if (!upstream.ok) throw new RequestFailure('HTTP_ERROR', { status: upstream.status });
    const body = {
      status: 'ready', mode: 'page', page: pageNo, pageCount: getSoopPageCount(data),
      provider: 'SOOP', category: 'Sudden Attack',
      broadcasts: projectSoopPage(data), updatedAt: new Date(now).toISOString(),
    };
    responseCache.set(cacheId, { body, expiresAt: now + CACHE_TTL_MS, staleUntil: now + STALE_TTL_MS });
    const response = jsonResponse(body, 200, { 'X-SOOP-Cache': 'MISS' });
    await storePublicResponse(context, edgeKey, response);
    return respond(response, { cache: 'MISS' });
  } catch (error) {
    const code = requestFailureCode(error);
    if (cached?.staleUntil > now) {
      return respond(jsonResponse({ ...cached.body, stale: true }, 200, { 'X-SOOP-Cache': 'STALE' }), { cache: 'STALE', code });
    }
    return respond(jsonResponse({ status: 'error', broadcasts: [] }, code === 'REQUEST_TIMEOUT' ? 504 : 502,
      { 'Cache-Control': 'no-store', 'X-SOOP-Cache': 'ERROR' }), { cache: 'ERROR', code });
  }
}

export function resetSoopLiveCacheForTests() {
  responseCache.clear();
}

export async function onRequest(context) {
  const { request, env = {} } = context;
  const trace = createApiTrace('soop-live');
  const respond = (response, details) => trace.finish(response, details);
  if (request.method === 'OPTIONS') {
    return respond(new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }));
  }
  if (request.method !== 'GET') return respond(jsonResponse({ error: 'Method not allowed' }, 405, { 'Cache-Control': 'no-store' }), { code: 'HTTP_ERROR' });

  const pageValues = new URL(request.url).searchParams.getAll('page');
  const pageNo = pageValues.length ? Number(pageValues[0]) : null;
  if (pageValues.length && (pageValues.length !== 1 || !/^[1-9]\d*$/.test(pageValues[0]) || pageNo > MAX_SOOP_PAGES)) {
    return respond(jsonResponse({ error: 'Invalid page' }, 400, { 'Cache-Control': 'no-store' }), { code: 'HTTP_ERROR' });
  }

  const providerUrl = buildSoopBroadListUrl(env);
  if (!providerUrl) return respond(jsonResponse(pendingPayload(), 200, { 'X-SOOP-Cache': 'DISABLED' }), { cache: 'DISABLED' });
  if (pageNo !== null) return servePage(context, pageNo, respond);

  const now = Date.now();
  const cached = responseCache.get(providerUrl);
  if (cached && cached.expiresAt > now) {
    return respond(jsonResponse(cached.body, 200, { 'X-SOOP-Cache': 'HIT' }), { cache: 'HIT' });
  }

  const edgeKey = await publicCacheKey(request.url, 'soop-live', { provider: providerUrl });
  const edgeResponse = await readPublicResponse(edgeKey, 'X-SOOP-Cache');
  if (edgeResponse) return respond(edgeResponse, { cache: 'EDGE_HIT' });

  try {
    // One budget covers the first page, parallel later pages and body reads.
    const { broadcasts, partialFailures } = await withRequestDeadline(async (signal) => {
      const deadline = Date.now() + 12000;
      const readPage = async (url) => {
        const { response, data } = await requestJson(url, {
          method: 'GET', headers: { Accept: 'application/json' },
        }, { signal, timeoutMs: Math.max(1, Math.min(10000, deadline - Date.now() - 50)) });
        if (!response.ok) throw new RequestFailure('HTTP_ERROR', { status: response.status });
        return data;
      };
      const firstPayload = await readPage(providerUrl);
      const remainingResults = await Promise.allSettled(
        Array.from({ length: getSoopPageCount(firstPayload) - 1 }, (_, index) => readPage(buildSoopBroadListUrl(env, index + 2)))
      );
      const remainingPayloads = remainingResults.filter((result) => result.status === 'fulfilled').map((result) => result.value);
      return {
        broadcasts: selectSoopBroadcasts([firstPayload, ...remainingPayloads]),
        partialFailures: remainingResults.filter((result) => result.status === 'rejected').length,
      };
    }, { timeoutMs: 12000 });
    const body = {
      status: 'ready',
      provider: 'SOOP',
      category: 'Sudden Attack',
      broadcasts,
      updatedAt: new Date(now).toISOString(),
    };
    responseCache.set(providerUrl, { body, expiresAt: now + CACHE_TTL_MS, staleUntil: now + STALE_TTL_MS });
    const response = jsonResponse(body, 200, { 'X-SOOP-Cache': 'MISS' });
    await storePublicResponse(context, edgeKey, response);
    return respond(response, { cache: 'MISS', code: partialFailures ? 'PARTIAL' : 'OK', partialFailures });
  } catch (error) {
    const code = requestFailureCode(error);
    if (cached && cached.staleUntil > now) {
      return respond(jsonResponse({ ...cached.body, stale: true }, 200, { 'X-SOOP-Cache': 'STALE' }), { cache: 'STALE', code });
    }
    return respond(jsonResponse({
      status: 'error',
      provider: 'SOOP',
      category: 'Sudden Attack',
      broadcasts: [],
      message: '라이브 방송 정보를 잠시 불러오지 못했습니다.',
    }, code === 'REQUEST_TIMEOUT' ? 504 : 502, { 'Cache-Control': 'no-store', 'X-SOOP-Cache': 'ERROR' }), { cache: 'ERROR', code });
  }
}
