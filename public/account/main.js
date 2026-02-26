function getAccountModules() {
  const domain = window.AccountDomain || {};
  const viewmodel = domain.viewmodel || {};
  const ui = domain.ui || {};
  const errorMessages = domain.errorMessages || {};
  return { viewmodel, ui, errorMessages };
}

function getAuthGateway() {
  return window.AuthGateway || null;
}

async function ensureLogin() {
  const gateway = getAuthGateway();
  if (gateway && gateway.waitForReady) await gateway.waitForReady();
  if (gateway && gateway.getCurrentUser) return gateway.getCurrentUser();
  return null;
}

function bindDeleteAction(providerIds) {
  const { viewmodel, errorMessages } = getAccountModules();
  const t = viewmodel.t || ((_, fallback) => fallback);
  const resolveDeleteAccountError = errorMessages.resolveDeleteAccountError || (() => ({
    key: "delete_account_failed",
    fallback: "회원탈퇴에 실패했습니다.",
  }));
  const deleteBtn = document.getElementById("account-delete-btn");
  if (!deleteBtn) return;

  deleteBtn.addEventListener("click", async () => {
    const confirmMessage = t(
      "delete_account_confirm",
      "정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다."
    );
    if (!confirm(confirmMessage)) return;

    const gateway = getAuthGateway();
    const authService = gateway && gateway.getAuthService
      ? await gateway.getAuthService()
      : await (window.authDomainReady || Promise.resolve(null));
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
  const { viewmodel, ui, errorMessages } = getAccountModules();
  const normalizeNickname = viewmodel.normalizeNickname || ((value) => (value || "").trim().toLowerCase());
  const validateNickname = viewmodel.validateNickname || (() => false);
  const getNicknameCooldownInfo = viewmodel.getNicknameCooldownInfo || (() => null);
  const formatDate = viewmodel.formatDate || ((value) => value || "-");
  const setStatusText = ui.setStatusText || (() => {});
  const resolveProfileSaveError = errorMessages.resolveProfileSaveError || (() => ({
    key: "profile_save_failed",
    fallback: "저장에 실패했습니다.",
    target: "profile",
  }));

  let nicknameChecked = false;
  let nicknameCheckedValue = normalizeNickname(viewModel.nickname);

  const nicknameInput = document.getElementById("nickname");
  const nicknameCheckBtn = document.getElementById("nickname-check");
  const nicknameStatus = document.getElementById("nickname-status");
  const nicknameCooldown = document.getElementById("nickname-cooldown");
  const profileSaveBtn = document.getElementById("profile-save");
  const profileStatus = document.getElementById("profile-status");

  const gateway = getAuthGateway();
  const authService = gateway && gateway.getAuthService
    ? await gateway.getAuthService()
    : await (window.authDomainReady || Promise.resolve(null));

  const cooldownInfo = getNicknameCooldownInfo(viewModel.nicknameUpdatedAt);
  if (nicknameCooldown) {
    if (cooldownInfo && cooldownInfo.remainingMs > 0) {
      nicknameCooldown.textContent = `${viewmodel.t("nickname_next_change", "다음 변경 가능:")} ${formatDate(cooldownInfo.nextAt)}`;
    } else {
      nicknameCooldown.textContent = viewmodel.t("nickname_change_available", "지금 변경 가능합니다.");
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
      if (!authService) {
        const mapped = resolveProfileSaveError({ code: "auth/service-unavailable" });
        setStatusText(profileStatus, mapped.key, mapped.fallback, false);
        return;
      }

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
        const mapped = resolveProfileSaveError(error);
        if (mapped.target === "nickname") {
          setStatusText(nicknameStatus, mapped.key, mapped.fallback, false);
          return;
        }
        setStatusText(profileStatus, mapped.key, mapped.fallback, false);
      }
    });
  }
}

async function renderAccount() {
  const { viewmodel, ui } = getAccountModules();
  const infoEl = document.getElementById("account-info");
  const actionsEl = document.getElementById("account-actions");
  if (!infoEl || !actionsEl) return;

  const user = await ensureLogin();
  if (!user) {
    if (ui.renderGuestView) ui.renderGuestView(infoEl, actionsEl);
    return;
  }

  const gateway = getAuthGateway();
  const profile = gateway && gateway.getCurrentUserProfile
    ? gateway.getCurrentUserProfile()
    : ((window.getCurrentUserProfile && window.getCurrentUserProfile()) || null);
  const accountViewModel = viewmodel.getAccountViewModel ? viewmodel.getAccountViewModel(user, profile) : null;
  if (!accountViewModel) return;

  if (ui.renderAccountView) ui.renderAccountView(infoEl, actionsEl, user, accountViewModel);
  await bindProfileActions(accountViewModel);
  bindDeleteAction(accountViewModel.providerIds);
}

function bindAuthStateUpdates() {
  if (window.AuthStateBus && typeof window.AuthStateBus.subscribe === "function") {
    return window.AuthStateBus.subscribe(() => {
      renderAccount();
    });
  }

  const handler = () => {
    renderAccount();
  };
  window.addEventListener("auth-state-changed", handler);
  return () => window.removeEventListener("auth-state-changed", handler);
}

document.addEventListener("DOMContentLoaded", () => {
  renderAccount();
  const unsubscribe = bindAuthStateUpdates();
  window.addEventListener("pagehide", () => unsubscribe(), { once: true });
});
