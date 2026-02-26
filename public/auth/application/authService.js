export function buildAuthService({ authRepository }) {
  if (!authRepository) {
    throw new Error("authRepository is required");
  }

  function signInWithProvider(providerId) {
    return authRepository.signInWithProvider(providerId);
  }

  function signInWithEmail(email, password) {
    return authRepository.signInWithEmail(email, password);
  }

  function signUpWithEmail(email, password) {
    return authRepository.signUpWithEmail(email, password);
  }

  function signOut() {
    return authRepository.signOut();
  }

  function checkNicknameAvailability(nickname) {
    return authRepository.checkNicknameAvailability(nickname);
  }

  function updateProfile({ nickname, photoURL } = {}) {
    return authRepository.updateProfile({ nickname, photoURL });
  }

  function deleteAccount({ password } = {}) {
    return authRepository.deleteAccount({ password });
  }

  function onAuthStateChanged(callback) {
    return authRepository.onAuthStateChanged(async (user) => {
      if (!user) {
        callback({ user: null, profile: null });
        return;
      }
      try {
        const profile = await authRepository.ensureUserProfile(user);
        callback({ user, profile });
      } catch (error) {
        console.error("Failed to load user profile:", error);
        callback({ user, profile: null });
      }
    });
  }

  return {
    signInWithProvider,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    checkNicknameAvailability,
    updateProfile,
    deleteAccount,
    onAuthStateChanged,
  };
}
