import { makeError } from "../application/errors.js";

export function assertRequiredFields(fields) {
  const missing = Object.entries(fields).filter(([, value]) => !value);
  if (missing.length) {
    throw makeError("REQUIRED_FIELDS");
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
