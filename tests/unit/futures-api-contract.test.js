import test from "node:test";
import assert from "node:assert/strict";
import { onRequest as onTvScanRequest } from "../../functions/api/tv-scan.js";
import { toPredictionHistoryItems } from "../../functions/api/futures-predictions.js";

function buildStooqCsv(days = 140, seed = 100) {
  const lines = ["Date,Open,High,Low,Close,Volume"];
  let close = seed;
  for (let i = 0; i < days; i += 1) {
    const day = String((i % 28) + 1).padStart(2, "0");
    const month = String(Math.floor(i / 28) + 1).padStart(2, "0");
    const date = `2025-${month}-${day}`;
    close = close * (1 + ((i % 5) - 2) * 0.002);
    lines.push(`${date},${close.toFixed(4)},${close.toFixed(4)},${close.toFixed(4)},${close.toFixed(4)},0`);
  }
  return `${lines.join("\n")}\n`;
}

test("tv-scan api returns analysis response schema", async () => {
  const originalFetch = global.fetch;
  const scannerRows = [
    { s: "AMEX:SPY", d: ["SPY", "S&P 500 ETF", 510.12, 0.81] },
    { s: "NASDAQ:QQQ", d: ["QQQ", "NASDAQ 100 ETF", 430.33, -0.22] },
    { s: "AMEX:DIA", d: ["DIA", "DOW ETF", 390.45, 0.14] },
    { s: "FX_IDC:USDKRW", d: ["USDKRW", "USD/KRW", 1330.5, 0.11] },
    { s: "TVC:GOLD", d: ["GOLD", "Gold Spot", 2150.1, -0.05] },
    { s: "BITSTAMP:BTCUSD", d: ["BTCUSD", "Bitcoin", 62000.2, 1.2] },
  ];
  const csvBySymbol = {
    "spy.us": buildStooqCsv(140, 500),
    "qqq.us": buildStooqCsv(140, 400),
    "dia.us": buildStooqCsv(140, 300),
    usdkrw: buildStooqCsv(140, 1200),
    xauusd: buildStooqCsv(140, 1900),
    btcusd: buildStooqCsv(140, 45000),
    "ewy.us": buildStooqCsv(140, 60),
  };

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes("scanner.tradingview.com/global/scan")) {
      return new Response(JSON.stringify({ data: scannerRows }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.includes("stooq.com/q/d/l/?s=")) {
      const match = u.match(/[?&]s=([^&]+)/);
      const symbol = decodeURIComponent(match ? match[1] : "");
      const csv = csvBySymbol[symbol];
      if (!csv) return new Response("No data", { status: 404 });
      return new Response(csv, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    throw new Error(`unexpected_fetch_url:${u}`);
  };

  try {
    const request = new Request("http://local/api/tv-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await onTvScanRequest({ request });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.ok(Array.isArray(payload.items));
    assert.equal(payload.items.length, 6);
    assert.equal(typeof payload.totalScore, "number");
    assert.equal(typeof payload.probabilityUp, "number");
    assert.equal(typeof payload.verdict, "string");
    assert.equal(typeof payload.model, "string");
    assert.equal(typeof payload.samples, "number");
    assert.equal(typeof payload.updatedAt, "string");
    for (const item of payload.items) {
      assert.equal(typeof item.symbol, "string");
      assert.equal(typeof item.name, "string");
      assert.equal(typeof item.signal, "string");
      assert.equal(typeof item.score, "number");
      assert.equal(typeof item.weighted, "number");
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test("futures-predictions document mapper returns stable history schema", () => {
  const docs = [
    {
      fields: {
        target_date: { stringValue: "2026-02-26" },
        prediction_label: { stringValue: "up" },
        actual_label: { stringValue: "down" },
        status: { stringValue: "evaluated" },
        is_hit: { booleanValue: false },
        probability_up: { doubleValue: 61.24 },
      },
    },
    {
      fields: {
        target_date: { stringValue: "2026-02-25" },
      },
    },
  ];
  const items = toPredictionHistoryItems(docs);
  assert.equal(items.length, 2);
  assert.deepEqual(Object.keys(items[0]).sort(), [
    "actual_label",
    "is_hit",
    "prediction_label",
    "probability_up",
    "status",
    "target_date",
  ]);
  assert.equal(items[0].target_date, "2026-02-26");
  assert.equal(items[0].prediction_label, "up");
  assert.equal(items[0].actual_label, "down");
  assert.equal(items[0].status, "evaluated");
  assert.equal(items[0].is_hit, false);
  assert.equal(items[0].probability_up, 61.24);
  assert.equal(items[1].prediction_label, "-");
  assert.equal(items[1].actual_label, "-");
  assert.equal(items[1].status, "predicted");
  assert.equal(items[1].is_hit, null);
  assert.equal(items[1].probability_up, null);
});
