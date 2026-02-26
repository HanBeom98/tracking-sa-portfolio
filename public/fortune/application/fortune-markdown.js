export function parseFortuneMarkdown(markdown) {
  const lines = String(markdown || "").split("\n");
  let html = "";
  let inList = false;
  let sectionOpen = false;

  const closeListIfNeeded = () => {
    if (!inList) return;
    html += "</ul>";
    inList = false;
  };

  const closeSectionIfNeeded = () => {
    closeListIfNeeded();
    if (!sectionOpen) return;
    html += "</div>";
    sectionOpen = false;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeListIfNeeded();
      continue;
    }

    if (trimmed.startsWith("### 🌟")) {
      closeSectionIfNeeded();
      html += `<div class="summary-box">${trimmed.replace("###", "").trim()}</div>`;
      continue;
    }

    if (trimmed.startsWith("###")) {
      closeSectionIfNeeded();
      html += `<div class="section-card"><h3>${trimmed.replace("###", "").trim()}</h3>`;
      sectionOpen = true;
      continue;
    }

    if (trimmed.startsWith("-")) {
      if (!sectionOpen) {
        html += '<div class="section-card">';
        sectionOpen = true;
      }
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${trimmed.slice(1).trim()}</li>`;
      continue;
    }

    if (!sectionOpen) {
      html += '<div class="section-card">';
      sectionOpen = true;
    }
    closeListIfNeeded();
    html += `<p>${trimmed}</p>`;
  }

  closeSectionIfNeeded();
  return html;
}
