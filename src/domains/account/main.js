import {
  t,
  normalizeNickname,
  validateNickname,
  getNicknameCooldownInfo,
  formatProvider,
  formatSubscription,
  formatDate,
  getAccountViewModel,
} from "./application/account-view-model.js";
import {
  resolveProfileSaveError,
  resolveDeleteAccountError,
  resolvePasswordChangeError,
} from "./application/error-messages.js";
import {
  renderGuestView,
  renderAccountView,
  setStatusText,
} from "./ui/account-renderer.js";

import { waitAuthReady, getCurrentUser, getCurrentUserProfile, getAuthService, requireAuth, subscribeAuthState } from '../auth/infra/auth-gateway.js';

let profileSaveFeedback = null;

async function ensureLogin() {
  await waitAuthReady();
  return getCurrentUser();
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

    const authService = await getAuthService();
    if (!authService) {
      const mapped = resolveDeleteAccountError({ code: "auth/service-unavailable" });
      alert(t(mapped.key, mapped.fallback));
      return;
    }

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
      const mapped = resolveDeleteAccountError(error);
      alert(t(mapped.key, mapped.fallback));
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

  const authService = await getAuthService();

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
      profileSaveFeedback = null;
      if (profileStatus) profileStatus.textContent = "";
      if (nicknameStatus) nicknameStatus.textContent = "";
    });
  }

  if (nicknameCheckBtn) {
    nicknameCheckBtn.addEventListener("click", async () => {
      const value = (nicknameInput && nicknameInput.value) || "";
      if (!validateNickname(value)) {
        setStatusText(nicknameStatus, "nickname_invalid", "닉네임은 2-12자(영문/숫자/한글/_)만 가능합니다.", false, t);
        return;
      }
      if (!authService) {
        const mapped = resolveProfileSaveError({ code: "auth/service-unavailable" });
        setStatusText(profileStatus, mapped.key, mapped.fallback, false, t);
        return;
      }

      const result = await authService.checkNicknameAvailability(value);
      if (result.available && result.owned) {
        nicknameChecked = true;
        nicknameCheckedValue = normalizeNickname(value);
        setStatusText(nicknameStatus, "nickname_owned", "현재 사용 중인 닉네임입니다.", true, t);
      } else if (result.available) {
        nicknameChecked = true;
        nicknameCheckedValue = normalizeNickname(value);
        setStatusText(nicknameStatus, "nickname_available", "사용 가능한 닉네임입니다.", true, t);
      } else {
        nicknameChecked = false;
        setStatusText(nicknameStatus, "nickname_taken", "이미 사용 중인 닉네임입니다.", false, t);
      }
    });
  }

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener("click", async () => {
      if (!authService) return;
      const nextNickname = (nicknameInput && nicknameInput.value) || "";
      const nextNormalized = normalizeNickname(nextNickname);

      if (!validateNickname(nextNickname)) {
        setStatusText(nicknameStatus, "nickname_invalid", "닉네임은 2-12자(영문/숫자/한글/_)만 가능합니다.", false, t);
        return;
      }

      if (nextNormalized !== normalizeNickname(viewModel.nickname)) {
        if (!nicknameChecked || nicknameCheckedValue !== nextNormalized) {
          setStatusText(nicknameStatus, "nickname_check_required", "닉네임 중복확인이 필요합니다.", false, t);
          return;
        }
      }

      try {
        profileSaveBtn.disabled = true;
        const profile = await authService.updateProfile({ nickname: nextNickname.trim() });
        viewModel.nickname = profile.nickname;
        viewModel.nicknameUpdatedAt = profile.nicknameUpdatedAt;
        nicknameChecked = true;
        nicknameCheckedValue = normalizeNickname(profile.nickname);
        profileSaveFeedback = { uid: profile.uid, nickname: profile.nickname };
        // Publishing the saved profile may have rendered a fresh account form.
        setStatusText(document.getElementById("profile-status"), "profile_saved", "저장되었습니다.", true, t);
        if (window.updateAuthControls) window.updateAuthControls(getCurrentUser());
      } catch (error) {
        console.error("프로필 저장 실패:", error);
        const mapped = resolveProfileSaveError(error);
        if (mapped.target === "nickname") {
          setStatusText(nicknameStatus, mapped.key, mapped.fallback, false, t);
          return;
        }
        setStatusText(profileStatus, mapped.key, mapped.fallback, false, t);
      } finally {
        profileSaveBtn.disabled = false;
      }
    });
  }
}

async function bindPasswordChangeAction() {
  const openBtn = document.getElementById("password-change-open");
  const modal = document.getElementById("password-change-modal");
  const closeBtn = document.getElementById("password-change-close");
  const changeBtn = document.getElementById("password-change");
  if (!openBtn || !modal || !changeBtn) return;

  const currentPasswordInput = document.getElementById("current-password");
  const newPasswordInput = document.getElementById("new-password");
  const confirmPasswordInput = document.getElementById("new-password-confirm");
  const statusEl = document.getElementById("password-change-status");

  const closeModal = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    statusEl.textContent = "";
    openBtn.focus();
  };

  const openModal = () => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    currentPasswordInput.focus();
  };

  openBtn.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("pointerdown", (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) closeModal();
  });

  const submitPasswordChange = async () => {
    const currentPassword = currentPasswordInput?.value || "";
    const newPassword = newPasswordInput?.value || "";
    const confirmPassword = confirmPasswordInput?.value || "";

    if (!currentPassword) {
      setStatusText(statusEl, "current_password_required", "현재 비밀번호를 입력해주세요.", false, t);
      return;
    }
    if (newPassword.length < 6) {
      setStatusText(statusEl, "password_change_weak", "새 비밀번호는 6자 이상이어야 합니다.", false, t);
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusText(statusEl, "password_change_mismatch", "새 비밀번호가 서로 일치하지 않습니다.", false, t);
      return;
    }
    if (newPassword === currentPassword) {
      setStatusText(statusEl, "password_change_same", "새 비밀번호는 현재 비밀번호와 달라야 합니다.", false, t);
      return;
    }

    const authService = await getAuthService();
    if (!authService || typeof authService.changePassword !== "function") {
      const mapped = resolvePasswordChangeError({ code: "auth/service-unavailable" });
      setStatusText(statusEl, mapped.key, mapped.fallback, false, t);
      return;
    }

    changeBtn.disabled = true;
    try {
      await authService.changePassword({ currentPassword, newPassword });
      currentPasswordInput.value = "";
      newPasswordInput.value = "";
      confirmPasswordInput.value = "";
      setStatusText(statusEl, "password_change_success", "비밀번호가 변경되었습니다.", true, t);
    } catch (error) {
      const mapped = resolvePasswordChangeError(error);
      setStatusText(statusEl, mapped.key, mapped.fallback, false, t);
    } finally {
      changeBtn.disabled = false;
    }
  };

  changeBtn.addEventListener("click", submitPasswordChange);
  confirmPasswordInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    submitPasswordChange();
  });
}

async function renderAccount() {
  const infoEl = document.getElementById("account-info");
  const actionsEl = document.getElementById("account-actions");
  if (!infoEl || !actionsEl) return;

  const user = await ensureLogin();
  if (!user) {
    renderGuestView(infoEl, actionsEl);
    
    // Bind login button action
    const loginBtn = document.getElementById("account-login-btn");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => {
        requireAuth({ redirectTo: "/account/" });
      });
    }
    return;
  }

  const profile = getCurrentUserProfile();
  const accountViewModel = getAccountViewModel(user, profile);

  renderAccountView(infoEl, actionsEl, user, accountViewModel, {
    formatProvider,
    formatSubscription,
    formatDate,
    translate: t,
  });
  await bindProfileActions(accountViewModel);
  if (profileSaveFeedback?.uid === user.uid && profileSaveFeedback.nickname === accountViewModel.nickname) {
    setStatusText(document.getElementById("profile-status"), "profile_saved", "저장되었습니다.", true, t);
  }
  await bindPasswordChangeAction();
  bindDeleteAction(accountViewModel.providerIds);
}

function bindAuthStateUpdates() {
  return subscribeAuthState(() => {
    renderAccount();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderAccount();
  const unsubscribe = bindAuthStateUpdates();
  window.addEventListener("pagehide", () => unsubscribe(), { once: true });
});
