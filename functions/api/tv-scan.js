import { fetchTradingViewScan, normalizeTickers } from "../../src/domains/futures-estimate/infra/tv_scan_service.js";
import { buildImpactAnalysis } from "../../src/domains/futures-estimate/application/build_impact_analysis.js";

function addCORSHeaders(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

export async function onRequest(context) {
  const { request } = context || {};
  if (!request) {
    return addCORSHeaders(
      new Response(JSON.stringify({ error: "No request object" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  if (request.method === "OPTIONS") {
    return addCORSHeaders(new Response(null, { status: 204 }));
  }
  if (request.method !== "POST") {
    return addCORSHeaders(
      new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const safeTickers = normalizeTickers(body?.tickers);
    if (!safeTickers.length) {
      throw new Error("No tickers");
    }

    const scannerRes = await fetchTradingViewScan(safeTickers);

    if (!scannerRes.ok) {
      throw new Error(`scanner_http_${scannerRes.status}`);
    }
    const scannerJson = await scannerRes.json();
    const analysis = buildImpactAnalysis(safeTickers, scannerJson?.data || []);

    return addCORSHeaders(
      new Response(JSON.stringify(analysis), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (error) {
    return addCORSHeaders(
      new Response(JSON.stringify({ error: String(error?.message || error) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
}
