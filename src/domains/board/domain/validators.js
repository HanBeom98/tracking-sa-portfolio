import { makeError } from "../application/errors.js";

export function assertRequiredFields(fields) {
  const missing = Object.entries(fields).filter(([, value]) => !value);
  if (missing.length) {
    throw makeError("REQUIRED_FIELDS");
  }
}

export function assertPasswordMatch(password, passwordConfirm) {
  if (password !== passwordConfirm) {
    throw makeError("PASSWORD_MISMATCH");
  }
}

export function assertPostExists(post) {
  if (!post) {
    throw makeError("POST_NOT_FOUND");
  }
}
