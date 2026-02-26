export const getNewsUrlKeyFromPath = (path = "") => {
  if (!path) return "";
  const normalized = path.replace(/^\/en\//, "/").replace(/^\//, "");
  if (!normalized || normalized === "news" || normalized === "news/" || normalized === "news/index.html") {
    return "";
  }
  return normalized.replace(/\.html$/, "");
};

export const resolveNewsLocale = ({ path = "", storedLang = "ko" } = {}) => {
  const isEnPath = path.startsWith("/en/");
  const isEn = storedLang === "en" || isEnPath;
  return { isEn, isEnPath };
};
