function formatProvider(providerIds) {
  const t = window.getTranslation || ((_, fallback) => fallback);
  if (providerIds.includes("password")) return t("account_provider_email", "이메일");
  if (providerIds.includes("google.com")) return t("account_provider_google", "Google");
  return t("account_provider_other", "기타");
}

function formatSubscription(status) {
  const t = window.getTranslation || ((_, fallback) => fallback);
  if (status === "active") return t("subscription_status_active", "구독중");
  if (status === "canceled") return t("subscription_status_canceled", "해지됨");
  if (status === "past_due") return t("subscription_status_past_due", "결제 실패");
  return t("subscription_status_free", "무료");
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch (error) {
    return value;
  }
}

async function ensureLogin() {
  if (!window.authStateReady) return null;
  return await window.authStateReady;
}

async function renderAccount() {
  const infoEl = document.getElementById("account-info");
  const actionsEl = document.getElementById("account-actions");
  if (!infoEl || !actionsEl) return;

  const user = await ensureLogin();
  if (!user) {
    infoEl.innerHTML = `
      <div class="account-guest">
        <p data-i18n="account_login_required">로그인 후 내 정보를 확인할 수 있습니다.</p>
        <button type="button" class="auth-button primary" id="account-login-btn" data-i18n="login">로그인</button>
      </div>
    `;
    actionsEl.innerHTML = "";
    if (window.applyTranslations) {
      const lang = localStorage.getItem("lang") || "ko";
      window.applyTranslations(lang);
    }
    const loginBtn = document.getElementById("account-login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        if (window.showAuthMenu) window.showAuthMenu();
      });
    }
    return;
  }

  const profile = (window.getCurrentUserProfile && window.getCurrentUserProfile()) || null;
  const providerIds = (user.providerData || []).map((p) => p.providerId);
  const subscription = (profile && profile.subscription) || {};
  const subscriptionStatus = subscription.status || "free";
  const subscriptionRenewAt = subscription.renewAt || subscription.nextBillingAt || "";
  const subscriptionExpiresAt = subscription.currentPeriodEnd || subscription.expiresAt || "";
  const subscriptionPlan = subscription.planName || subscription.plan || subscription.tier || "";
  const nickname = (profile && profile.nickname) || user.displayName || "";
  const nicknameUpdatedAt = profile && profile.nicknameUpdatedAt;
  const isAdmin = !!(profile && profile.role === "admin");
  const uidRow = isAdmin
    ? `
    <div class="account-row">
      <div class="account-label" data-i18n="account_uid">UID</div>
      <div class="account-value">${user.uid || "-"}</div>
    </div>`
    : "";

  infoEl.innerHTML = `
    <div class="account-row">
      <div class="account-label" data-i18n="account_email">이메일</div>
      <div class="account-value">${user.email || "-"}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_provider">로그인 방식</div>
      <div class="account-value">${formatProvider(providerIds)}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription">구독 상태</div>
      <div class="account-value">${formatSubscription(subscriptionStatus)}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription_plan">구독 플랜</div>
      <div class="account-value">${subscriptionPlan || "-"}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription_renew">다음 결제일</div>
      <div class="account-value">${subscriptionRenewAt ? formatDate(subscriptionRenewAt) : "-"}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription_expires">만료일</div>
      <div class="account-value">${subscriptionExpiresAt ? formatDate(subscriptionExpiresAt) : "-"}</div>
    </div>
    ${uidRow}
    <div class="account-row">
      <div class="account-label" data-i18n="account_created">가입일</div>
      <div class="account-value">${formatDate(user.metadata && user.metadata.creationTime)}</div>
    </div>
    <div class="account-section">
      <h2 data-i18n="profile_settings">프로필 설정</h2>
      <div class="account-form">
        <div>
          <label for="nickname" data-i18n="nickname">닉네임</label>
          <div class="nickname-row">
            <input id="nickname" type="text" value="${nickname}" placeholder="${window.getTranslation('nickname_placeholder', '닉네임을 입력하세요')}">
            <button type="button" class="auth-button" id="nickname-check" data-i18n="nickname_check">중복확인</button>
          </div>
          <div class="helper" id="nickname-status"></div>
          <div class="helper" id="nickname-cooldown"></div>
        </div>
        <button type="button" class="auth-button primary" id="profile-save" data-i18n="profile_save">저장</button>
        <div class="helper" id="profile-status"></div>
      </div>
    </div>
  `;

  actionsEl.innerHTML = `
    <button type="button" class="auth-button danger" id="account-delete-btn" data-i18n="delete_account">회원탈퇴</button>
  `;
  if (window.applyTranslations) {
    const lang = localStorage.getItem("lang") || "ko";
    window.applyTranslations(lang);
  }

  let nicknameChecked = false;
  let nicknameCheckedValue = normalizeNickname(nickname);

  const nicknameInput = document.getElementById("nickname");
  const nicknameCheckBtn = document.getElementById("nickname-check");
  const nicknameStatus = document.getElementById("nickname-status");
  const nicknameCooldown = document.getElementById("nickname-cooldown");
  const profileSaveBtn = document.getElementById("profile-save");
  const profileStatus = document.getElementById("profile-status");

  const authService = await (window.authDomainReady || Promise.resolve(null));

  function setNicknameStatus(messageKey, fallback, ok = false) {
    if (!nicknameStatus) return;
    nicknameStatus.textContent = window.getTranslation(messageKey, fallback);
    nicknameStatus.style.color = ok ? "#1b7f3a" : "#c62828";
  }

  function normalizeNickname(value) {
    return (value || "").trim().toLowerCase();
  }

  function setProfileStatus(messageKey, fallback, ok = false) {
    if (!profileStatus) return;
    profileStatus.textContent = window.getTranslation(messageKey, fallback);
    profileStatus.style.color = ok ? "#1b7f3a" : "#c62828";
  }

  function validateNickname(value) {
    const trimmed = (value || "").trim();
    const regex = /^[A-Za-z0-9가-힣_]{2,12}$/;
    return regex.test(trimmed);
  }

  function getNicknameCooldownInfo() {
    if (!nicknameUpdatedAt) return null;
    const lastTs = typeof nicknameUpdatedAt.toMillis === "function"
      ? nicknameUpdatedAt.toMillis()
      : new Date(nicknameUpdatedAt).getTime();
    if (!lastTs) return null;
    const cooldownMs = 24 * 60 * 60 * 1000;
    const nextAt = lastTs + cooldownMs;
    const now = Date.now();
    return { nextAt, remainingMs: Math.max(0, nextAt - now) };
  }

  const cooldownInfo = getNicknameCooldownInfo();
  if (nicknameCooldown) {
    if (cooldownInfo && cooldownInfo.remainingMs > 0) {
      nicknameCooldown.textContent = window.getTranslation(
        "nickname_next_change",
        "다음 변경 가능:"
      ) + " " + formatDate(cooldownInfo.nextAt);
    } else {
      nicknameCooldown.textContent = window.getTranslation(
        "nickname_change_available",
        "지금 변경 가능합니다."
      );
    }
  }

  if (nicknameInput) {
    nicknameInput.addEventListener("input", () => {
      nicknameChecked = false;
      nicknameStatus.textContent = "";
    });
  }

  if (nicknameCheckBtn) {
    nicknameCheckBtn.addEventListener("click", async () => {
      const value = (nicknameInput && nicknameInput.value) || "";
      if (!validateNickname(value)) {
        setNicknameStatus("nickname_invalid", "닉네임은 2-12자(영문/숫자/한글/_)만 가능합니다.", false);
        return;
      }
      if (!authService) return;
      const result = await authService.checkNicknameAvailability(value);
      if (result.available && result.owned) {
        nicknameChecked = true;
        nicknameCheckedValue = normalizeNickname(value);
        setNicknameStatus("nickname_owned", "현재 사용 중인 닉네임입니다.", true);
      } else if (result.available) {
        nicknameChecked = true;
        nicknameCheckedValue = normalizeNickname(value);
        setNicknameStatus("nickname_available", "사용 가능한 닉네임입니다.", true);
      } else {
        nicknameChecked = false;
        setNicknameStatus("nickname_taken", "이미 사용 중인 닉네임입니다.", false);
      }
    });
  }

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener("click", async () => {
      if (!authService) return;
      const nextNickname = (nicknameInput && nicknameInput.value) || "";

      if (normalizeNickname(nextNickname) !== normalizeNickname(nickname)) {
        if (!nicknameChecked || nicknameCheckedValue !== normalizeNickname(nextNickname)) {
          setNicknameStatus("nickname_check_required", "닉네임 중복확인이 필요합니다.", false);
          return;
        }
      }

      try {
        await authService.updateProfile({
          nickname: nextNickname.trim(),
        });
        setProfileStatus("profile_saved", "저장되었습니다.", true);
        if (window.updateAuthControls) window.updateAuthControls(window.getCurrentUser());
      } catch (error) {
        console.error("프로필 저장 실패:", error);
        if (error && error.code === "auth/nickname-taken") {
          setNicknameStatus("nickname_taken", "이미 사용 중인 닉네임입니다.", false);
          return;
        }
        if (error && error.code === "auth/invalid-nickname") {
          setNicknameStatus("nickname_invalid", "닉네임은 2-12자(영문/숫자/한글/_)만 가능합니다.", false);
          return;
        }
        if (error && error.code === "auth/nickname-cooldown") {
          setNicknameStatus("nickname_cooldown", "닉네임은 24시간에 1회만 변경할 수 있습니다.", false);
          return;
        }
        setProfileStatus("profile_save_failed", "저장에 실패했습니다.", false);
      }
    });
  }

  const deleteBtn = document.getElementById("account-delete-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const confirmMessage = window.getTranslation(
        "delete_account_confirm",
        "정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      );
      if (!confirm(confirmMessage)) return;

      const authService = await (window.authDomainReady || Promise.resolve(null));
      if (!authService) return;

      let password = null;
      if (providerIds.includes("password")) {
        const promptMessage = window.getTranslation(
          "delete_account_password_prompt",
          "탈퇴를 위해 비밀번호를 입력해주세요."
        );
        password = prompt(promptMessage) || "";
        if (!password) return;
      }

      try {
        await authService.deleteAccount({ password });
        alert(window.getTranslation("delete_account_success", "회원탈퇴가 완료되었습니다."));
        window.location.href = "/";
      } catch (error) {
        console.error("회원탈퇴 실패:", error);
        if (error && error.code === "auth/requires-recent-login") {
          alert(window.getTranslation("delete_account_requires_recent_login", "보안을 위해 다시 로그인 후 탈퇴를 진행해주세요."));
          return;
        }
        if (error && error.code === "auth/password-required") {
          alert(window.getTranslation("delete_account_password_prompt", "탈퇴를 위해 비밀번호를 입력해주세요."));
          return;
        }
        alert(window.getTranslation("delete_account_failed", "회원탈퇴에 실패했습니다."));
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderAccount();
});
