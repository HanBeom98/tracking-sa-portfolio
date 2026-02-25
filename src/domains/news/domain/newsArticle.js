export const stripMarkdown = (md = '') => {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/[#>*_~`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const makeExcerpt = (md = '', limit = 160) => {
  const text = stripMarkdown(md);
  if (!text) return '';
  return text.length > limit ? text.slice(0, limit).trim() + '…' : text;
};

export const renderMarkdown = (md = '') => {
  if (!md) return '';
  let html = md.replace(/\r\n/g, '\n');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '');
  return html;
};

export const resolveNewsFields = (data, isEn) => {
  const titleField = isEn ? 'titleEn' : 'titleKo';
  const contentField = isEn ? 'contentEn' : 'contentKo';
  return {
    title: data[titleField] || data.titleKo || data.titleEn || '',
    content: data[contentField] || data.contentKo || data.contentEn || '',
    date: data.date || '',
    urlKey: data.urlKey || (data.date && data.slug ? `${data.date}-${data.slug}` : ''),
  };
};

export const buildNewsHref = (urlKey, isEn) => {
  const basePath = isEn ? '/en' : '';
  return urlKey ? `${basePath}/${urlKey}.html` : `${basePath}/news/`;
};
