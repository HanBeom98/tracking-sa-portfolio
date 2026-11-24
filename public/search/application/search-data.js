export function normalizeSearchText(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

export function isSearchQueryValid(query) {
  return normalizeSearchText(query).replace(/\s/g, "").length >= 2;
}

export function filterSearchItems(items, query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const terms = normalized.split(" ");
  return (items || []).filter((item) => {
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    const fields = [item.title, item.description, ...keywords]
      .map(value => normalizeSearchText(value).replace(/\s/g, ""));
    return terms.every(term => fields.some(field => field.includes(term)));
  });
}
