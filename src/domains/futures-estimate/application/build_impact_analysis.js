import { classifySignal, verdictFromScore } from "../domain/impact_rules.js";

export function buildImpactAnalysis(tickers, quotes) {
  const bySymbol = new Map((quotes || []).map((q) => [q.symbol, q]));

  let totalScore = 0;
  const items = tickers.map((symbol) => {
    const q = bySymbol.get(symbol);
    if (!q) {
      return {
        symbol,
        name: symbol,
        close: null,
        change: null,
        signal: "데이터 없음",
        score: 0,
      };
    }

    const signal = classifySignal(symbol, q.change ?? 0);
    totalScore += signal.score;

    return {
      symbol,
      name: q.name || symbol,
      close: q.close,
      change: q.change,
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
