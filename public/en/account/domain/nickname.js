export function normalizeNickname(value) {
  return (value || "").trim().toLowerCase();
}

export function validateNickname(value) {
  const trimmed = (value || "").trim();
  return /^[A-Za-z0-9가-힣_]{2,12}$/.test(trimmed);
}

export function getNicknameCooldownInfo(nicknameUpdatedAt) {
  if (!nicknameUpdatedAt) return null;
  const lastTs = typeof nicknameUpdatedAt.toMillis === "function"
    ? nicknameUpdatedAt.toMillis()
    : new Date(nicknameUpdatedAt).getTime();
  if (!lastTs) return null;
  const cooldownMs = 24 * 60 * 60 * 1000;
  const nextAt = lastTs + cooldownMs;
  return { nextAt, remainingMs: Math.max(0, nextAt - Date.now()) };
}
