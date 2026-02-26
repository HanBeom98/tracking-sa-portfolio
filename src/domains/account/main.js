function formatProvider(providerIds) {
  const t = window.getTranslation || ((_, fallback) => fallback);
  if (providerIds.includes("password")) return t("account_provider_email", "이메일");
  if (providerIds.includes("google.com")) return t("account_provider_google", "Google");
  return t("account_provider_other", "기타");
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
        <button type="button" id="account-login-btn" data-i18n="login">로그인</button>
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
  const role = (profile && profile.role) || "free";

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
      <div class="account-label" data-i18n="account_uid">UID</div>
      <div class="account-value">${user.uid || "-"}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_role">권한</div>
      <div class="account-value">${role}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_created">가입일</div>
      <div class="account-value">${formatDate(user.metadata && user.metadata.creationTime)}</div>
    </div>
  `;

  actionsEl.innerHTML = `
    <button type="button" class="danger" id="account-delete-btn" data-i18n="delete_account">회원탈퇴</button>
  `;
  if (window.applyTranslations) {
    const lang = localStorage.getItem("lang") || "ko";
    window.applyTranslations(lang);
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
