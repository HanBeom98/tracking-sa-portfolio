/**
 * Sudden Attack API Proxy (Cloudflare Pages Functions)
 * Safely attaches the NEXON_API_KEY and reuses successful GET responses.
 */

import { requestJson, requestFailureCode } from '../../src/domains/shared/http-request.js';
import { createApiTrace } from '../infra/api-observability.js';
import { publicCacheKey, readPublicResponse, storePublicResponse } from '../infra/public-response-cache.js';

const responseCache = new Map();
const pendingRequests = new Map();
const MAX_CACHE_ENTRIES = 1000;
const NEXON_API_ORIGIN = 'https://open.api.nexon.com';
const ALLOWED_ORIGIN = 'https://trackingsa.com';
const ALLOWED_API_PATHS = new Set([
    '/suddenattack/v1/id',
    '/suddenattack/v1/user/basic',
    '/suddenattack/v1/user/rank',
    '/suddenattack/v1/user/tier',
    '/suddenattack/v1/user/recent-info',
    '/suddenattack/v1/match',
    '/suddenattack/v1/match-detail',
    '/static/suddenattack/meta/grade',
    '/static/suddenattack/meta/season_grade',
    '/static/suddenattack/meta/tier',
]);

function getCachePolicy(pathname) {
    if (pathname.includes('/match-detail')) return { ttlMs: 24 * 60 * 60 * 1000, browserMaxAge: 300 };
    if (pathname.includes('/static/')) return { ttlMs: 24 * 60 * 60 * 1000, browserMaxAge: 3600 };
    if (pathname.endsWith('/id')) return { ttlMs: 10 * 60 * 1000, browserMaxAge: 60 };
    if (pathname.includes('/user/basic')) return { ttlMs: 5 * 60 * 1000, browserMaxAge: 60 };
    if (pathname.includes('/user/rank') || pathname.includes('/user/tier')) {
        return { ttlMs: 2 * 60 * 1000, browserMaxAge: 30 };
    }
    if (pathname.includes('/user/recent-info')) return { ttlMs: 60 * 1000, browserMaxAge: 15 };
    if (pathname.endsWith('/match')) return { ttlMs: 30 * 1000, browserMaxAge: 10 };
    return { ttlMs: 30 * 1000, browserMaxAge: 10 };
}

function pruneCache(now = Date.now()) {
    for (const [key, entry] of responseCache) {
        if (entry.expiresAt <= now) responseCache.delete(key);
    }
    while (responseCache.size >= MAX_CACHE_ENTRIES) {
        responseCache.delete(responseCache.keys().next().value);
    }
}

function buildHeaders(policy, cacheStatus) {
    const sharedMaxAge = Math.max(1, Math.floor(policy.ttlMs / 1000));
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Cache-Control': `public, max-age=${policy.browserMaxAge}, s-maxage=${sharedMaxAge}, stale-while-revalidate=${sharedMaxAge}`,
        'X-SA-Cache': cacheStatus
    };
}

async function fetchNexon(finalUrl, apiKey) {
    const { response, data } = await requestJson(finalUrl.toString(), {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'x-nxopen-api-key': apiKey
        }
    });
    return { body: JSON.stringify(data), status: response.status };
}

export function resetSaProxyCacheForTests() {
    responseCache.clear();
    pendingRequests.clear();
}

export async function onRequest(context) {
    const trace = createApiTrace('sa-proxy');
    let cacheStatus = 'NONE';
    const respond = (response, code = response.ok ? 'OK' : 'HTTP_ERROR') => trace.finish(response, { code, cache: cacheStatus });
    return handleRequest(context, respond, (value) => { cacheStatus = value; });
}

async function handleRequest(context, respond, setCacheStatus) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return respond(new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        }));
    }

    if (request.method !== 'GET') {
        return respond(new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
        }));
    }

    try {
        const url = new URL(request.url);
        const targetPath = url.searchParams.get('path');

        if (!targetPath) {
            return respond(new Response(JSON.stringify({ error: 'Missing path parameter' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
            }));
        }

        if (!targetPath.startsWith('/') || targetPath.startsWith('//')) {
            return respond(new Response(JSON.stringify({ error: 'Unsupported API path' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
            }));
        }

        const finalUrl = new URL(targetPath, NEXON_API_ORIGIN);
        if (finalUrl.origin !== NEXON_API_ORIGIN || !ALLOWED_API_PATHS.has(finalUrl.pathname)) {
            return respond(new Response(JSON.stringify({ error: 'Unsupported API path' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
            }));
        }
        url.searchParams.forEach((value, key) => {
            if (key !== 'path') finalUrl.searchParams.set(key, value);
        });

        const apiKey = String(env?.NEXON_API_KEY || '').trim();
        if (!apiKey) {
            return respond(new Response(JSON.stringify({
                error: 'NEXON_API_KEY is not configured',
                code: 'NEXON_API_KEY_MISSING'
            }), {
                status: 503,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
                    'Cache-Control': 'no-store'
                }
            }), 'CONFIGURATION_ERROR');
        }

        const policy = getCachePolicy(finalUrl.pathname);
        const cacheKey = finalUrl.toString();
        const now = Date.now();
        const cached = request.method === 'GET' ? responseCache.get(cacheKey) : null;
        if (cached && cached.expiresAt > now) {
            setCacheStatus('HIT');
            return respond(new Response(cached.body, {
                status: cached.status,
                headers: buildHeaders(policy, 'HIT')
            }));
        }

        const edgeKey = await publicCacheKey(request.url, 'sa-proxy', { target: cacheKey });
        const edgeResponse = await readPublicResponse(edgeKey, 'X-SA-Cache');
        if (edgeResponse) {
            setCacheStatus('EDGE_HIT');
            return respond(edgeResponse);
        }

        let pending = request.method === 'GET' ? pendingRequests.get(cacheKey) : null;
        const cacheStatus = pending ? 'COALESCED' : 'MISS';
        setCacheStatus(cacheStatus);

        if (!pending) {
            pending = fetchNexon(finalUrl, apiKey);
            if (request.method === 'GET') pendingRequests.set(cacheKey, pending);
        }

        let result;
        try {
            result = await pending;
        } finally {
            if (pendingRequests.get(cacheKey) === pending) pendingRequests.delete(cacheKey);
        }

        if (request.method === 'GET' && result.status >= 200 && result.status < 300) {
            pruneCache(now);
            responseCache.set(cacheKey, { ...result, expiresAt: now + policy.ttlMs });
        }

        const response = new Response(result.body, {
            status: result.status,
            headers: { ...buildHeaders(policy, cacheStatus), ...(result.status >= 300 ? { 'Cache-Control': 'no-store' } : {}) }
        });
        await storePublicResponse(context, edgeKey, response);
        return respond(response);
    } catch (error) {
        const code = requestFailureCode(error);
        return respond(new Response(JSON.stringify({ error: 'Upstream request failed', code }), {
            status: code === 'REQUEST_TIMEOUT' ? 504 : code === 'UNKNOWN_ERROR' ? 500 : 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Cache-Control': 'no-store' }
        }), code);
    }
}
