import {
  normalizeNickname,
  validateNickname,
  getNicknameCooldownInfo,
} from "../domain/nickname.js";

export function t(key, fallback) {
  return window.getTranslation ? window.getTranslation(key, fallback) : fallback;
}

export function formatProvider(providerIds) {
  if (providerIds.includes("password")) return t("account_provider_email", "이메일");
  if (providerIds.includes("google.com")) return t("account_provider_google", "Google");
  return t("account_provider_other", "기타");
}

export function formatSubscription(status) {
  if (status === "active") return t("subscription_status_active", "구독중");
  if (status === "canceled") return t("subscription_status_canceled", "해지됨");
  if (status === "past_due") return t("subscription_status_past_due", "결제 실패");
  return t("subscription_status_free", "무료");
}

export function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}

export function getAccountViewModel(user, profile) {
  const providerIds = (user.providerData || []).map((p) => p.providerId);
  const subscription = (profile && profile.subscription) || {};
  return {
    providerIds,
    subscriptionStatus: subscription.status || "free",
    subscriptionRenewAt: subscription.renewAt || subscription.nextBillingAt || "",
    subscriptionExpiresAt: subscription.currentPeriodEnd || subscription.expiresAt || "",
    subscriptionPlan: subscription.planName || subscription.plan || subscription.tier || "",
    nickname: (profile && profile.nickname) || user.displayName || "",
    nicknameUpdatedAt: profile && profile.nicknameUpdatedAt,
    isAdmin: !!(profile && profile.role === "admin"),
  };
}

export { normalizeNickname, validateNickname, getNicknameCooldownInfo };
