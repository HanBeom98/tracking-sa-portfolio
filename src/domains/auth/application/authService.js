export function buildAuthService({ authRepository }) {
  if (!authRepository) {
    throw new Error("authRepository is required");
  }
  const subscriptions = new Set();

  function deliver(subscription, state) {
    try {
      subscription.callback(state);
    } catch (error) {
      console.error("Auth state listener failed:", error);
    }
  }

  function signInWithEmail(email, password) {
    return authRepository.signInWithEmail(email, password);
  }

  function signUpWithEmail(email, password) {
    return authRepository.signUpWithEmail(email, password);
  }

  function changePassword({ currentPassword, newPassword } = {}) {
    return authRepository.changePassword({ currentPassword, newPassword });
  }

  function signOut() {
    return authRepository.signOut();
  }

  function checkNicknameAvailability(nickname) {
    return authRepository.checkNicknameAvailability(nickname);
  }

  async function updateProfile({ nickname, photoURL } = {}) {
    const profile = await authRepository.updateProfile({ nickname, photoURL });
    for (const subscription of subscriptions) {
      if (subscription.user?.uid !== profile?.uid) continue;
      subscription.version++;
      deliver(subscription, { user: subscription.user, profile });
    }
    return profile;
  }

  function deleteAccount({ password } = {}) {
    return authRepository.deleteAccount({ password });
  }

  function onAuthStateChanged(callback) {
    const subscription = { callback, user: null, version: 0 };
    subscriptions.add(subscription);
    const unsubscribe = authRepository.onAuthStateChanged(async (user) => {
      subscription.user = user;
      const version = ++subscription.version;
      if (!user) {
        deliver(subscription, { user: null, profile: null });
        return;
      }
      try {
        const profile = await authRepository.ensureUserProfile(user);
        if (subscriptions.has(subscription) && version === subscription.version) deliver(subscription, { user, profile });
      } catch (error) {
        console.error("Failed to load user profile:", error);
        if (subscriptions.has(subscription) && version === subscription.version) deliver(subscription, { user, profile: null });
      }
    });
    return () => {
      subscriptions.delete(subscription);
      subscription.version++;
      unsubscribe();
    };
  }

  return {
    signInWithEmail,
    signUpWithEmail,
    changePassword,
    signOut,
    checkNicknameAvailability,
    updateProfile,
    deleteAccount,
    onAuthStateChanged,
  };
}
