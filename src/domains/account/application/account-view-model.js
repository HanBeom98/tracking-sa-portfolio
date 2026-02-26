(function () {
  function t(key, fallback) {
    return window.getTranslation ? window.getTranslation(key, fallback) : fallback;
  }

  function formatProvider(providerIds) {
    if (providerIds.includes("password")) return t("account_provider_email", "이메일");
    if (providerIds.includes("google.com")) return t("account_provider_google", "Google");
    return t("account_provider_other", "기타");
  }

  function formatSubscription(status) {
    if (status === "active") return t("subscription_status_active", "구독중");
    if (status === "canceled") return t("subscription_status_canceled", "해지됨");
    if (status === "past_due") return t("subscription_status_past_due", "결제 실패");
    return t("subscription_status_free", "무료");
  }

  function formatDate(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("ko-KR");
    } catch {
      return value;
    }
  }

  function normalizeNickname(value) {
    return (value || "").trim().toLowerCase();
  }

  function validateNickname(value) {
    const trimmed = (value || "").trim();
    return /^[A-Za-z0-9가-힣_]{2,12}$/.test(trimmed);
  }

  function getNicknameCooldownInfo(nicknameUpdatedAt) {
    if (!nicknameUpdatedAt) return null;
    const lastTs = typeof nicknameUpdatedAt.toMillis === "function"
      ? nicknameUpdatedAt.toMillis()
      : new Date(nicknameUpdatedAt).getTime();
    if (!lastTs) return null;
    const cooldownMs = 24 * 60 * 60 * 1000;
    const nextAt = lastTs + cooldownMs;
    return { nextAt, remainingMs: Math.max(0, nextAt - Date.now()) };
  }

  function getAccountViewModel(user, profile) {
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

  window.AccountDomain = window.AccountDomain || {};
  window.AccountDomain.viewmodel = {
    t,
    formatProvider,
    formatSubscription,
    formatDate,
    normalizeNickname,
    validateNickname,
    getNicknameCooldownInfo,
    getAccountViewModel,
  };
})();
