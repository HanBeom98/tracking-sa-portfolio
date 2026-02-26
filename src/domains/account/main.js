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
  const subscription = (profile && profile.subscription) || {};
  const subscriptionStatus = subscription.status || "free";
  const subscriptionRenewAt = subscription.renewAt || subscription.nextBillingAt || "";
  const subscriptionExpiresAt = subscription.currentPeriodEnd || subscription.expiresAt || "";
  const nickname = (profile && profile.nickname) || user.displayName || "";
  const photoURL = (profile && profile.photoURL) || user.photoURL || "";

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
      <div class="account-label" data-i18n="account_subscription_renew">다음 결제일</div>
      <div class="account-value">${subscriptionRenewAt ? formatDate(subscriptionRenewAt) : "-"}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription_expires">만료일</div>
      <div class="account-value">${subscriptionExpiresAt ? formatDate(subscriptionExpiresAt) : "-"}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_uid">UID</div>
      <div class="account-value">${user.uid || "-"}</div>
    </div>
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
            <button type="button" id="nickname-check" data-i18n="nickname_check">중복확인</button>
          </div>
          <div class="helper" id="nickname-status"></div>
        </div>
        <div>
          <label for="photo-url" data-i18n="profile_image">프로필 이미지</label>
          <input id="photo-url" type="text" value="${photoURL}" placeholder="${window.getTranslation('profile_image_placeholder', '이미지 URL을 입력하세요')}">
          <div class="avatar-row" style="margin-top:10px;">
            <input id="avatar-file" type="file" accept="image/*">
            <button type="button" id="avatar-upload" data-i18n="profile_image_upload">업로드</button>
          </div>
          <div class="profile-preview" id="profile-preview" style="margin-top:10px;">
            ${photoURL ? `<img src="${photoURL}" alt="profile">` : ""}
            <span class="helper" data-i18n="profile_image_hint">원형 이미지로 표시됩니다.</span>
          </div>
        </div>
        <button type="button" class="primary" id="profile-save" data-i18n="profile_save">저장</button>
        <div class="helper" id="profile-status"></div>
      </div>
    </div>
  `;

  actionsEl.innerHTML = `
    <button type="button" class="danger" id="account-delete-btn" data-i18n="delete_account">회원탈퇴</button>
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
  const photoInput = document.getElementById("photo-url");
  const avatarFileInput = document.getElementById("avatar-file");
  const avatarUploadBtn = document.getElementById("avatar-upload");
  const profilePreview = document.getElementById("profile-preview");
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
      if (result.available) {
        nicknameChecked = true;
        nicknameCheckedValue = normalizeNickname(value);
        setNicknameStatus("nickname_available", "사용 가능한 닉네임입니다.", true);
      } else {
        nicknameChecked = false;
        setNicknameStatus("nickname_taken", "이미 사용 중인 닉네임입니다.", false);
      }
    });
  }

  if (photoInput && profilePreview) {
    photoInput.addEventListener("input", () => {
      const value = (photoInput.value || "").trim();
      profilePreview.innerHTML = value
        ? `<img src="${value}" alt="profile"><span class="helper" data-i18n="profile_image_hint">원형 이미지로 표시됩니다.</span>`
        : `<span class="helper" data-i18n="profile_image_hint">원형 이미지로 표시됩니다.</span>`;
      if (window.applyTranslations) {
        const lang = localStorage.getItem("lang") || "ko";
        window.applyTranslations(lang);
      }
    });
  }

  async function resizeImage(file) {
    const maxSize = 256;
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });
    const canvas = document.createElement("canvas");
    const size = Math.min(maxSize, Math.max(img.width, img.height));
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const sx = Math.max(0, (img.width - img.height) / 2);
    const sy = Math.max(0, (img.height - img.width) / 2);
    const sSize = Math.min(img.width, img.height);
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  }

  if (avatarUploadBtn && avatarFileInput) {
    avatarUploadBtn.addEventListener("click", async () => {
      if (!authService) return;
      const file = avatarFileInput.files && avatarFileInput.files[0];
      if (!file) {
        setProfileStatus("profile_image_required", "이미지를 선택해주세요.", false);
        return;
      }
      try {
        setProfileStatus("profile_image_uploading", "이미지 업로드 중...", true);
        const resized = await resizeImage(file);
        const uploadUrl = await authService.uploadAvatar(resized || file);
        if (photoInput) photoInput.value = uploadUrl;
        if (profilePreview) {
          profilePreview.innerHTML = `<img src="${uploadUrl}" alt="profile"><span class="helper" data-i18n="profile_image_hint">원형 이미지로 표시됩니다.</span>`;
        }
        setProfileStatus("profile_image_uploaded", "업로드 완료", true);
        if (window.applyTranslations) {
          const lang = localStorage.getItem("lang") || "ko";
          window.applyTranslations(lang);
        }
      } catch (error) {
        console.error("이미지 업로드 실패:", error);
        setProfileStatus("profile_image_upload_failed", "업로드에 실패했습니다.", false);
      }
    });
  }

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener("click", async () => {
      if (!authService) return;
      const nextNickname = (nicknameInput && nicknameInput.value) || "";
      const nextPhoto = (photoInput && photoInput.value) || "";

      if (normalizeNickname(nextNickname) !== normalizeNickname(nickname)) {
        if (!nicknameChecked || nicknameCheckedValue !== normalizeNickname(nextNickname)) {
          setNicknameStatus("nickname_check_required", "닉네임 중복확인이 필요합니다.", false);
          return;
        }
      }

      try {
        await authService.updateProfile({
          nickname: nextNickname.trim(),
          photoURL: nextPhoto.trim(),
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
