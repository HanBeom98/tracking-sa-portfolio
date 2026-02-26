import { makeExcerpt, renderMarkdown, resolveNewsFields, buildNewsHref } from "../domain/newsArticle.js";

export const mapNewsDocToCard = (doc, isEn) => {
  const { title, content, date, urlKey } = resolveNewsFields(doc, isEn);
  return {
    title,
    date,
    excerpt: makeExcerpt(content),
    href: buildNewsHref(urlKey, isEn),
  };
};

export const mapNewsDocToArticle = (doc, isEn) => {
  const { title, content } = resolveNewsFields(doc, isEn);
  return {
    title,
    htmlContent: renderMarkdown(content),
  };
};
