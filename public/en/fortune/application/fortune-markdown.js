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

  // 인라인 스타일 (Bold 등) 처리 함수
  const parseInline = (text) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeListIfNeeded();
      continue;
    }

    // 헤더 처리 (## 또는 ###)
    if (trimmed.startsWith("### 🌟") || trimmed.startsWith("## 🌟")) {
      closeSectionIfNeeded();
      html += `<div class="summary-box">${parseInline(trimmed.replace(/^#+/, "").trim())}</div>`;
      continue;
    }

    if (trimmed.startsWith("###") || trimmed.startsWith("##")) {
      closeSectionIfNeeded();
      html += '<div class="section-card">';
      html += `<h3>${parseInline(trimmed.replace(/^#+/, "").trim())}</h3>`;
      sectionOpen = true;
      continue;
    }

    // 리스트 처리
    if (trimmed.startsWith("-") || trimmed.startsWith("* ")) {
      if (!sectionOpen) {
        html += '<div class="section-card">';
        sectionOpen = true;
      }
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${parseInline(trimmed.replace(/^[-*]\s*/, ""))}</li>`;
      continue;
    }

    // 일반 텍스트 처리
    if (!sectionOpen) {
      html += '<div class="section-card">';
      sectionOpen = true;
    }
    closeListIfNeeded();
    html += `<p>${parseInline(trimmed)}</p>`;
  }

  closeSectionIfNeeded();
  return html;
}
