(function () {
  function resolveProfileSaveError(error) {
    const code = error && error.code ? String(error.code) : "";
    if (code === "auth/nickname-taken") {
      return { key: "nickname_taken", fallback: "이미 사용 중인 닉네임입니다.", target: "nickname" };
    }
    if (code === "auth/invalid-nickname") {
      return { key: "nickname_invalid", fallback: "닉네임은 2-12자(영문/숫자/한글/_)만 가능합니다.", target: "nickname" };
    }
    if (code === "auth/nickname-cooldown") {
      return { key: "nickname_cooldown", fallback: "닉네임은 24시간에 1회만 변경할 수 있습니다.", target: "nickname" };
    }
    if (code === "auth/not-authenticated") {
      return { key: "account_profile_auth_required", fallback: "프로필 저장은 로그인 후 이용할 수 있습니다.", target: "profile" };
    }
    if (code === "auth/service-unavailable") {
      return { key: "account_profile_service_unavailable", fallback: "프로필 저장 기능을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", target: "profile" };
    }
    return { key: "profile_save_failed", fallback: "저장에 실패했습니다.", target: "profile" };
  }

  function resolveDeleteAccountError(error) {
    const code = error && error.code ? String(error.code) : "";
    if (code === "auth/requires-recent-login") {
      return { key: "delete_account_requires_recent_login", fallback: "보안을 위해 다시 로그인 후 탈퇴를 진행해주세요." };
    }
    if (code === "auth/password-required") {
      return { key: "delete_account_password_prompt", fallback: "탈퇴를 위해 비밀번호를 입력해주세요." };
    }
    if (code === "auth/not-authenticated") {
      return { key: "account_delete_auth_required", fallback: "회원탈퇴는 로그인 후 이용할 수 있습니다." };
    }
    if (code === "auth/service-unavailable") {
      return { key: "account_delete_service_unavailable", fallback: "회원탈퇴 기능을 불러오지 못했습니다. 잠시 후 다시 시도해주세요." };
    }
    return { key: "delete_account_failed", fallback: "회원탈퇴에 실패했습니다." };
  }

  window.AccountDomain = window.AccountDomain || {};
  window.AccountDomain.errorMessages = {
    resolveProfileSaveError,
    resolveDeleteAccountError,
  };
})();
