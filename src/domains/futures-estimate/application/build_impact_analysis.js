import { classifySignal, verdictFromScore } from "../domain/impact_rules.js";

export function buildImpactAnalysis(tickers, scannerRows) {
  const bySymbol = new Map((scannerRows || []).map((r) => [r.s, r.d]));
  const ordered = tickers.filter((s) => bySymbol.has(s));

  let totalScore = 0;
  const items = ordered.map((symbol) => {
    const d = bySymbol.get(symbol) || [];
    const name = d[0] || symbol;
    const close = typeof d[2] === "number" ? d[2] : null;
    const change = typeof d[3] === "number" ? d[3] : null;
    const signal = classifySignal(symbol, change ?? 0);
    totalScore += signal.score;

    return {
      symbol,
      name,
      close,
      change,
      signal: signal.text,
      score: signal.score,
    };
  });

  return {
    items,
    totalScore,
    verdict: verdictFromScore(totalScore),
    updatedAt: new Date().toISOString(),
  };
}

