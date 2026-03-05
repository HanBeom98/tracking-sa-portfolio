import { classifyContribution, verdictFromProbability } from "../domain/impact_rules.js";

export function buildImpactAnalysis(tickers, quotes, modelResult) {
  const bySymbol = new Map((quotes || []).map((q) => [q.symbol, q]));

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
        weighted: 0,
      };
    }

    const w = modelResult?.weightsBySymbol?.[symbol] ?? 0;
    const z = modelResult?.zBySymbol?.[symbol] ?? 0;
    const weighted = w * z;
    const signal = classifyContribution(weighted);

    return {
      symbol,
      name: q.name || symbol,
      close: q.close,
      change: q.change,
      signal: signal.text,
      score: signal.score,
      weighted: Number(weighted.toFixed(4)),
    };
  });

  const pUp = modelResult?.pUp ?? 0.5;
  const totalScore = Number(((pUp - 0.5) * 20).toFixed(2));

  return {
    items,
    totalScore,
    probabilityUp: Number((pUp * 100).toFixed(2)),
    verdict: verdictFromProbability(pUp),
    model: "logistic_regression",
    samples: modelResult?.samples ?? 0,
    target: modelResult?.target ?? "EWY",
    updatedAt: new Date().toISOString(),
  };
}
