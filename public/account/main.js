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

function applyCurrentLangTranslations() {
  if (!window.applyTranslations) return;
  const lang = localStorage.getItem("lang") || "ko";
  window.applyTranslations(lang);
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

function setStatusText(element, messageKey, fallback, ok = false) {
  if (!element) return;
  element.textContent = t(messageKey, fallback);
  element.style.color = ok ? "#1b7f3a" : "#c62828";
}

async function ensureLogin() {
  if (window.authStateReady) await window.authStateReady;
  if (typeof window.getCurrentUser === "function") return window.getCurrentUser();
  return null;
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

function renderGuestView(infoEl, actionsEl) {
  infoEl.innerHTML = "";
  const promptEl = window.createLoginRequiredPrompt
    ? window.createLoginRequiredPrompt({
        wrapperClass: "account-guest",
        messageKey: "account_login_required",
        messageText: "로그인 후 내 정보를 확인할 수 있습니다.",
        buttonId: "account-login-btn",
        redirectTo: "/account/",
      })
    : null;

  if (promptEl) {
    infoEl.appendChild(promptEl);
  } else {
    infoEl.innerHTML = `
      <div class="account-guest">
        <p data-i18n="account_login_required">로그인 후 내 정보를 확인할 수 있습니다.</p>
        <button type="button" class="auth-button primary" id="account-login-btn" data-i18n="login">로그인</button>
      </div>
    `;
  }
  actionsEl.innerHTML = "";
  applyCurrentLangTranslations();
}

function renderAccountView(infoEl, actionsEl, user, viewModel) {
  const uidRow = viewModel.isAdmin
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
      <div class="account-value">${formatProvider(viewModel.providerIds)}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription">구독 상태</div>
      <div class="account-value">${formatSubscription(viewModel.subscriptionStatus)}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription_plan">구독 플랜</div>
      <div class="account-value">${viewModel.subscriptionPlan || "-"}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription_renew">다음 결제일</div>
      <div class="account-value">${viewModel.subscriptionRenewAt ? formatDate(viewModel.subscriptionRenewAt) : "-"}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription_expires">만료일</div>
      <div class="account-value">${viewModel.subscriptionExpiresAt ? formatDate(viewModel.subscriptionExpiresAt) : "-"}</div>
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
            <input id="nickname" type="text" value="${viewModel.nickname}" placeholder="${t("nickname_placeholder", "닉네임을 입력하세요")}">
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
  applyCurrentLangTranslations();
}

function bindDeleteAction(providerIds) {
  const deleteBtn = document.getElementById("account-delete-btn");
  if (!deleteBtn) return;

  deleteBtn.addEventListener("click", async () => {
    const confirmMessage = t(
      "delete_account_confirm",
      "정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다."
    );
    if (!confirm(confirmMessage)) return;

    const authService = await (window.authDomainReady || Promise.resolve(null));
    if (!authService) return;

    let password = null;
    if (providerIds.includes("password")) {
      const promptMessage = t(
        "delete_account_password_prompt",
        "탈퇴를 위해 비밀번호를 입력해주세요."
      );
      password = prompt(promptMessage) || "";
      if (!password) return;
    }

    try {
      await authService.deleteAccount({ password });
      alert(t("delete_account_success", "회원탈퇴가 완료되었습니다."));
      window.location.href = "/";
    } catch (error) {
      console.error("회원탈퇴 실패:", error);
      if (error && error.code === "auth/requires-recent-login") {
        alert(t("delete_account_requires_recent_login", "보안을 위해 다시 로그인 후 탈퇴를 진행해주세요."));
        return;
      }
      if (error && error.code === "auth/password-required") {
        alert(t("delete_account_password_prompt", "탈퇴를 위해 비밀번호를 입력해주세요."));
        return;
      }
      alert(t("delete_account_failed", "회원탈퇴에 실패했습니다."));
    }
  });
}

async function bindProfileActions(viewModel) {
  let nicknameChecked = false;
  let nicknameCheckedValue = normalizeNickname(viewModel.nickname);

  const nicknameInput = document.getElementById("nickname");
  const nicknameCheckBtn = document.getElementById("nickname-check");
  const nicknameStatus = document.getElementById("nickname-status");
  const nicknameCooldown = document.getElementById("nickname-cooldown");
  const profileSaveBtn = document.getElementById("profile-save");
  const profileStatus = document.getElementById("profile-status");

  const authService = await (window.authDomainReady || Promise.resolve(null));

  const cooldownInfo = getNicknameCooldownInfo(viewModel.nicknameUpdatedAt);
  if (nicknameCooldown) {
    if (cooldownInfo && cooldownInfo.remainingMs > 0) {
      nicknameCooldown.textContent = `${t("nickname_next_change", "다음 변경 가능:")} ${formatDate(cooldownInfo.nextAt)}`;
    } else {
      nicknameCooldown.textContent = t("nickname_change_available", "지금 변경 가능합니다.");
    }
  }

  if (nicknameInput) {
    nicknameInput.addEventListener("input", () => {
      nicknameChecked = false;
      if (nicknameStatus) nicknameStatus.textContent = "";
    });
  }

  if (nicknameCheckBtn) {
    nicknameCheckBtn.addEventListener("click", async () => {
      const value = (nicknameInput && nicknameInput.value) || "";
      if (!validateNickname(value)) {
        setStatusText(nicknameStatus, "nickname_invalid", "닉네임은 2-12자(영문/숫자/한글/_)만 가능합니다.", false);
        return;
      }
      if (!authService) return;

      const result = await authService.checkNicknameAvailability(value);
      if (result.available && result.owned) {
        nicknameChecked = true;
        nicknameCheckedValue = normalizeNickname(value);
        setStatusText(nicknameStatus, "nickname_owned", "현재 사용 중인 닉네임입니다.", true);
      } else if (result.available) {
        nicknameChecked = true;
        nicknameCheckedValue = normalizeNickname(value);
        setStatusText(nicknameStatus, "nickname_available", "사용 가능한 닉네임입니다.", true);
      } else {
        nicknameChecked = false;
        setStatusText(nicknameStatus, "nickname_taken", "이미 사용 중인 닉네임입니다.", false);
      }
    });
  }

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener("click", async () => {
      if (!authService) return;
      const nextNickname = (nicknameInput && nicknameInput.value) || "";
      const nextNormalized = normalizeNickname(nextNickname);

      if (nextNormalized !== normalizeNickname(viewModel.nickname)) {
        if (!nicknameChecked || nicknameCheckedValue !== nextNormalized) {
          setStatusText(nicknameStatus, "nickname_check_required", "닉네임 중복확인이 필요합니다.", false);
          return;
        }
      }

      try {
        await authService.updateProfile({ nickname: nextNickname.trim() });
        setStatusText(profileStatus, "profile_saved", "저장되었습니다.", true);
        if (window.updateAuthControls) window.updateAuthControls(window.getCurrentUser());
      } catch (error) {
        console.error("프로필 저장 실패:", error);
        if (error && error.code === "auth/nickname-taken") {
          setStatusText(nicknameStatus, "nickname_taken", "이미 사용 중인 닉네임입니다.", false);
          return;
        }
        if (error && error.code === "auth/invalid-nickname") {
          setStatusText(nicknameStatus, "nickname_invalid", "닉네임은 2-12자(영문/숫자/한글/_)만 가능합니다.", false);
          return;
        }
        if (error && error.code === "auth/nickname-cooldown") {
          setStatusText(nicknameStatus, "nickname_cooldown", "닉네임은 24시간에 1회만 변경할 수 있습니다.", false);
          return;
        }
        setStatusText(profileStatus, "profile_save_failed", "저장에 실패했습니다.", false);
      }
    });
  }
}

async function renderAccount() {
  const infoEl = document.getElementById("account-info");
  const actionsEl = document.getElementById("account-actions");
  if (!infoEl || !actionsEl) return;

  const user = await ensureLogin();
  if (!user) {
    renderGuestView(infoEl, actionsEl);
    return;
  }

  const profile = (window.getCurrentUserProfile && window.getCurrentUserProfile()) || null;
  const viewModel = getAccountViewModel(user, profile);

  renderAccountView(infoEl, actionsEl, user, viewModel);
  await bindProfileActions(viewModel);
  bindDeleteAction(viewModel.providerIds);
}

document.addEventListener("DOMContentLoaded", () => {
  renderAccount();
  window.addEventListener("auth-state-changed", () => {
    renderAccount();
  });
});
