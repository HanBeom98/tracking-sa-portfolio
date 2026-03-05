function qs(key) {
  return new URLSearchParams(window.location.search).get(key) || '';
}

async function getAuthService() {
  if (window.AuthService) return window.AuthService;
  if (window.authDomainReady) {
    const service = await window.authDomainReady;
    if (service) return service;
  }
  return null;
}

function initSignup() {
  const form = document.getElementById('signup-form');
  const backButton = document.getElementById('back-login');
  if (!form || !backButton) return;

  backButton.addEventListener('click', () => {
    window.history.length > 1 ? window.history.back() : window.location.href = '/';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    if (!email || !password) {
      alert('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      alert('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    const authService = await getAuthService();
    if (!authService) {
      alert('회원가입 기능이 아직 준비되지 않았습니다.');
      return;
    }
    try {
      await authService.signUpWithEmail(email, password);
      const redirect = qs('redirect') || '/';
      window.location.href = redirect;
    } catch (error) {
      console.error('회원가입 실패:', error);
      alert('회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSignup);
} else {
  initSignup();
}
