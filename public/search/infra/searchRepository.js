export async function loadSearchIndex() {
  const res = await fetch("/search-index.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`index_http_${res.status}`);
  return res.json();
}
