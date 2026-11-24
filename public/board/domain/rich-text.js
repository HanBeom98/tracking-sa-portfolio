const ALLOWED_TAGS = new Set(['DIV', 'P', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'A', 'FONT', 'BR']);
const SAFE_FONT_SIZES = new Set(['2', '3', '4', '5', '6', '7']);
export const BOARD_RICH_TEXT_MARKER = '[[board-rich:v1]]';

function isSafeColor(value) {
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(value);
}

function sanitizeElement(element) {
  const tag = element.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT') {
    element.remove();
    return;
  }
  if (!ALLOWED_TAGS.has(tag)) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const align = /text-align\s*:\s*(left|center|right)/i.exec(element.getAttribute('style') || '')?.[1]?.toLowerCase();
  const href = element.getAttribute('href') || '';
  const size = element.getAttribute('size') || '';
  const color = element.getAttribute('color') || '';
  [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));

  if ((tag === 'DIV' || tag === 'P') && align) element.style.textAlign = align;
  if (tag === 'FONT' && SAFE_FONT_SIZES.has(size)) element.setAttribute('size', size);
  if (tag === 'FONT' && isSafeColor(color)) element.setAttribute('color', color);
  if (tag === 'A') {
    try {
      const url = new URL(href, window.location.origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        element.href = url.href;
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      } else {
        element.replaceWith(...element.childNodes);
      }
    } catch {
      element.replaceWith(...element.childNodes);
    }
  }
}

export function sanitizeBoardRichText(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  [...template.content.querySelectorAll('*')].reverse().forEach(sanitizeElement);
  return template.innerHTML;
}

export function createSafeBoardLink(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}
