export function createCryptoAdapter(crypto = window.CryptoJS) {
  if (!crypto || !crypto.SHA256) {
    throw new Error("CryptoJS SHA256 is not available");
  }

  return {
    hash(value) {
      return crypto.SHA256(value).toString();
    },
  };
}
