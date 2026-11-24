const HTML_ENTITIES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

// For HTML text and quoted attributes. URLs and intentional markup need their
// own validation; do not escape stored values or search identifiers in advance.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => HTML_ENTITIES[character]);
}
