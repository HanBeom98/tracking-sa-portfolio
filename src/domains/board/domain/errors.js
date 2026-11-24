export function makeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
