function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export function applyCurrentLangTranslations() {
  if (!window.applyTranslations) return;
  window.applyTranslations("ko");
}

export function setStatusText(element, messageKey, fallback, ok = false, translate = (_, text) => text) {
  if (!element) return;
  element.textContent = translate(messageKey, fallback);
  element.style.color = ok ? "#1b7f3a" : "#c62828";
}

export function renderGuestView(infoEl, actionsEl) {
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

export function renderAccountView(infoEl, actionsEl, user, viewModel, deps) {
  const {
    formatProvider,
    formatSubscription,
    formatDate,
    translate,
  } = deps;

  const uidRow = viewModel.isAdmin
    ? `
      <div class="account-row">
        <div class="account-label" data-i18n="account_uid">UID</div>
        <div class="account-value">${escapeHtml(user.uid || "-")}</div>
      </div>`
    : "";
  const passwordSection = viewModel.providerIds.includes("password")
    ? `
    <div class="account-section">
      <h2 data-i18n="password_change_title">비밀번호 변경</h2>
      <button type="button" class="auth-button account-password-open" id="password-change-open" data-i18n="password_change_submit">비밀번호 변경</button>
      <div class="account-password-modal" id="password-change-modal" aria-hidden="true">
        <div class="account-password-dialog" role="dialog" aria-modal="true" aria-labelledby="password-change-dialog-title">
          <div class="account-password-dialog-header">
            <h2 id="password-change-dialog-title" data-i18n="password_change_title">비밀번호 변경</h2>
            <button type="button" class="account-password-close" id="password-change-close" aria-label="닫기" data-i18n-attr="aria-label:close">×</button>
          </div>
          <div class="account-form">
            <div>
              <label for="current-password" data-i18n="current_password">현재 비밀번호</label>
              <input id="current-password" type="password" autocomplete="current-password">
            </div>
            <div>
              <label for="new-password" data-i18n="new_password">새 비밀번호</label>
              <input id="new-password" type="password" minlength="6" autocomplete="new-password">
            </div>
            <div>
              <label for="new-password-confirm" data-i18n="new_password_confirm">새 비밀번호 확인</label>
              <input id="new-password-confirm" type="password" minlength="6" autocomplete="new-password">
            </div>
            <button type="button" class="auth-button primary" id="password-change" data-i18n="password_change_submit">비밀번호 변경</button>
            <div class="helper" id="password-change-status" role="status" aria-live="polite"></div>
          </div>
        </div>
      </div>
    </div>`
    : "";

  infoEl.innerHTML = `
    <div class="account-row">
      <div class="account-label" data-i18n="account_email">이메일</div>
      <div class="account-value">${escapeHtml(user.email || "-")}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_provider">로그인 방식</div>
      <div class="account-value">${escapeHtml(formatProvider(viewModel.providerIds))}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription">구독 상태</div>
      <div class="account-value">${escapeHtml(formatSubscription(viewModel.subscriptionStatus))}</div>
    </div>
    <div class="account-row">
      <div class="account-label" data-i18n="account_subscription_plan">구독 플랜</div>
      <div class="account-value">${escapeHtml(viewModel.subscriptionPlan || "-")}</div>
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
            <input id="nickname" type="text" maxlength="12" value="${escapeHtml(viewModel.nickname)}" placeholder="${translate("nickname_placeholder", "닉네임을 입력하세요")}">
            <button type="button" class="auth-button" id="nickname-check" data-i18n="nickname_check">중복확인</button>
          </div>
          <div class="helper" id="nickname-status"></div>
          <div class="helper" id="nickname-cooldown"></div>
        </div>
        <button type="button" class="auth-button primary" id="profile-save" data-i18n="profile_save">저장</button>
        <div class="helper" id="profile-status"></div>
      </div>
    </div>
    ${passwordSection}
  `;

  actionsEl.innerHTML = `
    <button type="button" class="auth-button danger" id="account-delete-btn" data-i18n="delete_account">회원탈퇴</button>
  `;
  applyCurrentLangTranslations();
}
