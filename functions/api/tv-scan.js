import { normalizeTickers } from "../../src/domains/futures-estimate/domain/impact_rules.js";
import { fetchTradingViewScan, mapTradingViewRowsToQuotes } from "../../src/domains/futures-estimate/infra/tv_scan_service.js";
import { buildImpactAnalysis } from "../../src/domains/futures-estimate/application/build_impact_analysis.js";
import { runLogisticMarketModel } from "../../src/domains/futures-estimate/application/logistic_model.js";

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
    const quotes = mapTradingViewRowsToQuotes(scannerJson?.data || []);
    if (!quotes.length) throw new Error("quotes_empty");

    const currentReturnsMap = new Map(
      quotes
        .filter((q) => typeof q?.change === "number")
        .map((q) => [q.symbol, q.change / 100])
    );

    const modelResult = await runLogisticMarketModel(safeTickers, currentReturnsMap);
    const analysis = buildImpactAnalysis(safeTickers, quotes, modelResult);

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
