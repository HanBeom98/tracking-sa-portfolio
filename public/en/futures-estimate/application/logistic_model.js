import { TARGET_CONFIG, featureBySymbol } from "../domain/impact_rules.js";
import { fetchStooqDailySeries, toDailyReturns } from "../infra/stooq_market_data.js";

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

function trainLogistic(X, y, { epochs = 500, lr = 0.08, l2 = 0.001 } = {}) {
  if (!X.length) return { w: [], b: 0 };
  const m = X[0].length;
  const w = Array(m).fill(0);
  let b = 0;

  for (let e = 0; e < epochs; e += 1) {
    const gw = Array(m).fill(0);
    let gb = 0;
    for (let i = 0; i < X.length; i += 1) {
      const p = sigmoid(dot(w, X[i]) + b);
      const err = p - y[i];
      gb += err;
      for (let j = 0; j < m; j += 1) gw[j] += err * X[i][j];
    }
    for (let j = 0; j < m; j += 1) {
      gw[j] = (gw[j] / X.length) + l2 * w[j];
      w[j] -= lr * gw[j];
    }
    gb /= X.length;
    b -= lr * gb;
  }
  return { w, b };
}

function meanStd(values) {
  if (!values.length) return { mean: 0, std: 1 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const varc = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
  const std = Math.sqrt(varc) || 1;
  return { mean, std };
}

export async function runLogisticMarketModel(symbols, currentReturnsMap) {
  const featureDefs = symbols.map((s) => featureBySymbol(s)).filter(Boolean);
  if (!featureDefs.length) throw new Error("no_features");

  const sourceList = featureDefs.map((f) => f.source);
  const allSources = [...sourceList, TARGET_CONFIG.source];
  const seriesList = await Promise.all(allSources.map((s) => fetchStooqDailySeries(s)));
  const returnMaps = seriesList.map((series) => toDailyReturns(series));

  const featureReturnMaps = returnMaps.slice(0, featureDefs.length);
  const targetReturnMap = returnMaps[returnMaps.length - 1];
  const targetDates = [...targetReturnMap.keys()].sort();

  const rowsRaw = [];
  const y = [];
  for (const d of targetDates) {
    const targetRet = targetReturnMap.get(d);
    if (typeof targetRet !== "number") continue;
    const row = [];
    let ok = true;
    for (const mp of featureReturnMaps) {
      const v = mp.get(d);
      if (typeof v !== "number") {
        ok = false;
        break;
      }
      row.push(v);
    }
    if (!ok) continue;
    rowsRaw.push(row);
    y.push(targetRet > 0 ? 1 : 0);
  }

  const maxLookback = 260;
  const start = Math.max(0, rowsRaw.length - maxLookback);
  const Xraw = rowsRaw.slice(start);
  const Y = y.slice(start);
  if (Xraw.length < 80) throw new Error("insufficient_samples");

  const means = [];
  const stds = [];
  const X = Xraw.map((row) => row.slice());
  for (let j = 0; j < featureDefs.length; j += 1) {
    const col = Xraw.map((r) => r[j]);
    const ms = meanStd(col);
    means.push(ms.mean);
    stds.push(ms.std);
    for (let i = 0; i < X.length; i += 1) {
      X[i][j] = (X[i][j] - ms.mean) / ms.std;
    }
  }

  const model = trainLogistic(X, Y);

  const latestRaw = Xraw[Xraw.length - 1];
  const zNow = featureDefs.map((f, idx) => {
    const v = currentReturnsMap.get(f.symbol);
    const x = typeof v === "number" ? v : latestRaw[idx];
    return (x - means[idx]) / stds[idx];
  });

  const logit = dot(model.w, zNow) + model.b;
  const pUp = sigmoid(logit);

  const weightsBySymbol = {};
  const zBySymbol = {};
  for (let i = 0; i < featureDefs.length; i += 1) {
    weightsBySymbol[featureDefs[i].symbol] = model.w[i];
    zBySymbol[featureDefs[i].symbol] = zNow[i];
  }

  return {
    pUp,
    weightsBySymbol,
    zBySymbol,
    samples: Xraw.length,
    lookback: Math.min(maxLookback, Xraw.length),
    target: TARGET_CONFIG.name,
  };
}

