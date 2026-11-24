import { requestWithTimeout, RequestFailure, requestFailureCode } from '../../src/domains/shared/http-request.js';
import { createApiTrace } from '../infra/api-observability.js';

const NEXON_API_ORIGIN = 'https://open.api.nexon.com';
const ALLOWED_ORIGIN = 'https://trackingsa.com';
const IMAGE_PATH_PATTERN = /^\/static\/suddenattack\/img\/[a-f0-9]{32}$/i;

function responseHeaders(contentType = 'image/png') {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
  };
}

export async function onRequest(context) {
  const trace = createApiTrace('sa-image');
  const respond = (response, code = response.ok ? 'OK' : 'HTTP_ERROR') => trace.finish(response, { code });
  const { request } = context;
  if (request.method === 'OPTIONS') {
    return respond(new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    }));
  }

  if (request.method !== 'GET') {
    return respond(new Response('Method not allowed', { status: 405, headers: { 'Cache-Control': 'no-store' } }));
  }

  const requestUrl = new URL(request.url);
  const targetPath = requestUrl.searchParams.get('path') || '';
  if (!IMAGE_PATH_PATTERN.test(targetPath)) {
    return respond(new Response('Unsupported image path', { status: 400, headers: { 'Cache-Control': 'no-store' } }));
  }

  try {
    const image = await requestWithTimeout(new URL(targetPath, NEXON_API_ORIGIN), {
      headers: { accept: 'image/avif,image/webp,image/png,image/*' },
    }, {
      readResponse: async (upstream) => {
        const contentType = upstream.headers.get('content-type') || '';
        if (!upstream.ok) throw new RequestFailure('HTTP_ERROR', { status: upstream.status });
        if (!contentType.startsWith('image/')) throw new RequestFailure('INVALID_RESPONSE');
        return { contentType, bytes: await upstream.arrayBuffer() };
      },
    });

    return respond(new Response(image.bytes, {
      status: 200,
      headers: responseHeaders(image.contentType),
    }));
  } catch (error) {
    const code = requestFailureCode(error);
    return respond(new Response('Image unavailable', {
      status: code === 'REQUEST_TIMEOUT' ? 504 : error.status || 502,
      headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    }), code);
  }
}
