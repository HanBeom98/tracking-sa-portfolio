async function fetchImpactAnalysis() {
  const response = await fetch("/api/tv-scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error(`analysis_http_${response.status}`);
  return response.json();
}

async function fetchPredictionHistory() {
  const response = await fetch("/api/futures-predictions", { method: "GET" });
  if (!response.ok) throw new Error(`history_http_${response.status}`);
  return response.json();
}

export { fetchImpactAnalysis, fetchPredictionHistory };
