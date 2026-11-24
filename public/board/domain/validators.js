import { makeError } from './errors.js?v=b5a12b75bd51';

export function assertRequiredFields(fields) {
  const missing = Object.entries(fields).filter(([, value]) => !value);
  if (missing.length) {
    throw makeError("REQUIRED_FIELDS");
  }
}

export function assertPostFieldLengths({ title, content }) {
  if (String(title || "").length > 120 || String(content || "").length > 10000) {
    throw makeError("POST_TOO_LONG");
  }
}

export function assertPostExists(post) {
  if (!post) {
    throw makeError("POST_NOT_FOUND");
  }
}

export function assertAuthor(author) {
  if (!author || !author.uid) {
    throw makeError("AUTH_REQUIRED");
  }
}
