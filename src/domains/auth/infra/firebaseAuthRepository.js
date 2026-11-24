import { ADMIN_EMAILS, DEFAULT_ROLE, Roles } from "../domain/roles.js";
import { normalizeAccessEmail } from '../domain/access-policy.js';

export function createFirebaseAuthRepository({ firebaseApp = window.firebase, db = window.db } = {}) {
  if (!firebaseApp || !firebaseApp.auth) {
    throw new Error("Firebase Auth SDK is not available");
  }
  if (!db) {
    throw new Error("Firestore db is not available on window.db");
  }

  const auth = firebaseApp.auth();
  const nicknamesCollection = db.collection("nicknames");

  function getServerTimestamp() {
    if (firebaseApp && firebaseApp.firestore && firebaseApp.firestore.FieldValue) {
      return firebaseApp.firestore.FieldValue.serverTimestamp();
    }
    return null;
  }

  function resolveRoleForUser(user, existingRole = DEFAULT_ROLE) {
    const email = normalizeAccessEmail(user && user.email);
    if (email && ADMIN_EMAILS.includes(email)) {
      return Roles.ADMIN;
    }
    return existingRole || DEFAULT_ROLE;
  }

  function signInWithEmail(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  }

  function signUpWithEmail(email, password) {
    return auth.createUserWithEmailAndPassword(email, password);
  }

  async function changePassword({ currentPassword, newPassword } = {}) {
    const user = auth.currentUser;
    if (!user || !user.email) {
      const error = new Error("Not authenticated");
      error.code = "auth/not-authenticated";
      throw error;
    }
    if (!currentPassword) {
      const error = new Error("Current password is required");
      error.code = "auth/current-password-required";
      throw error;
    }
    if (!newPassword || newPassword.length < 6) {
      const error = new Error("New password is too weak");
      error.code = "auth/weak-password";
      throw error;
    }

    const credential = firebaseApp.auth.EmailAuthProvider.credential(
      user.email,
      currentPassword
    );
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
  }

  function signOut() {
    return auth.signOut();
  }

  function normalizeNickname(value) {
    return (value || "").trim().toLowerCase();
  }

  function profileError(code, message) {
    return Object.assign(new Error(message), { code });
  }

  // Firestore owns the profile. Auth's display fields are a repairable copy;
  // an Auth outage after a committed transaction must not report a failed save.
  async function syncAuthProfile(user, profile) {
    if (auth.currentUser?.uid !== user.uid) return;
    const updates = {};
    const displayName = profile.nickname || profile.displayName || "";
    if ((user.displayName || "") !== displayName) updates.displayName = displayName;
    if ((user.photoURL || "") !== (profile.photoURL || "")) updates.photoURL = profile.photoURL || "";
    if (!Object.keys(updates).length) return;
    try {
      await user.updateProfile(updates);
    } catch (error) {
      console.warn("Saved profile; Auth display sync will retry on next profile load:", error.code || "unknown");
    }
  }

  async function checkNicknameAvailability(nickname) {
    const key = normalizeNickname(nickname);
    if (!/^[A-Za-z0-9가-힣_]{2,12}$/.test((nickname || "").trim())) {
      return { available: false, key, reason: "invalid" };
    }
    const snapshot = await nicknamesCollection.doc(key).get();
    if (!snapshot.exists) {
      return { available: true, key };
    }
    const data = snapshot.data() || {};
    const user = auth.currentUser;
    if (user && data.uid === user.uid) {
      return { available: true, key, owned: true };
    }
    return { available: false, key, reason: "taken" };
  }

  async function updateProfile({ nickname, photoURL } = {}) {
    const user = auth.currentUser;
    if (!user) {
      throw profileError("auth/not-authenticated", "Not authenticated");
    }
    const nextNickname = typeof nickname === "string" ? nickname.trim() : null;
    if (nextNickname !== null && !/^[A-Za-z0-9가-힣_]{2,12}$/.test(nextNickname)) {
      throw profileError("auth/invalid-nickname", "Invalid nickname");
    }
    const profileRef = db.collection("users").doc(user.uid);
    const committed = await db.runTransaction(async (transaction) => {
      const profileSnap = await transaction.get(profileRef);
      if (!profileSnap.exists) throw profileError("auth/profile-unavailable", "User profile is not ready");
      const current = profileSnap.data();
      const updates = {};
      let changedAt = null;

      if (nextNickname !== null) {
        const key = normalizeNickname(nextNickname);
        const oldKey = normalizeNickname(current.nickname);
        const changed = oldKey !== key;
        const now = Date.now();
        const last = current.nicknameUpdatedAt;
        const lastMs = last?.toMillis ? last.toMillis() : (last ? new Date(last).getTime() : 0);
        const remaining = lastMs + 24 * 60 * 60 * 1000 - now;
        if (changed && remaining > 0) {
          throw Object.assign(profileError("auth/nickname-cooldown", "Nickname change cooldown"), { retryAfterMs: remaining });
        }

        const nextRef = nicknamesCollection.doc(key);
        const nextSnap = await transaction.get(nextRef);
        const oldRef = changed && oldKey ? nicknamesCollection.doc(oldKey) : null;
        const oldSnap = oldRef ? await transaction.get(oldRef) : null;
        if (nextSnap.exists && nextSnap.data().uid !== user.uid) {
          throw profileError("auth/nickname-taken", "Nickname already taken");
        }
        // All reads precede writes. Each retry rechecks ownership and cooldown.
        if (oldSnap?.exists && oldSnap.data().uid === user.uid) transaction.delete(oldRef);
        if (!nextSnap.exists || nextSnap.data().nickname !== nextNickname) {
          transaction.set(nextRef, { uid: user.uid, nickname: nextNickname, updatedAt: getServerTimestamp() });
        }
        if (current.nickname !== nextNickname) updates.nickname = nextNickname;
        if (current.displayName !== nextNickname) updates.displayName = nextNickname;
        if (changed) {
          updates.nicknameUpdatedAt = getServerTimestamp();
          changedAt = new Date(now);
        }
      }
      if (typeof photoURL === "string" && current.photoURL !== photoURL) updates.photoURL = photoURL;
      if (Object.keys(updates).length) transaction.set(profileRef, updates, { merge: true });
      // Only used if the post-commit read is unavailable; server time remains
      // authoritative in storage. The Date is an approximate UI cooldown hint.
      return { uid: user.uid, ...current, ...updates, ...(changedAt ? { nicknameUpdatedAt: changedAt } : {}) };
    });

    let profile = committed;
    try {
      profile = await getUserProfile(user.uid) || committed;
    } catch (error) {
      console.warn("Profile saved; using committed values until the next load:", error.code || "unknown");
    }
    await syncAuthProfile(user, profile);
    return profile;
  }


  async function deleteAccount({ password } = {}) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Not authenticated");
    }

    const providerIds = (user.providerData || []).map((p) => p.providerId);
    const hasPassword = providerIds.includes("password");

    if (hasPassword) {
      if (!password) {
        const error = new Error("Password required for reauthentication");
        error.code = "auth/password-required";
        throw error;
      }
      const credential = firebaseApp.auth.EmailAuthProvider.credential(
        user.email,
        password
      );
      await user.reauthenticateWithCredential(credential);
    }

    try {
      await db.collection("users").doc(user.uid).delete();
    } catch (error) {
      console.warn("Failed to delete user profile:", error);
    }

    await user.delete();
  }

  function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
  }

  async function ensureUserProfile(user) {
    const docRef = db.collection("users").doc(user.uid);
    const profile = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(docRef);
      if (snapshot.exists) {
        const existing = snapshot.data() || {};
        const resolvedRole = resolveRoleForUser(user, existing.role);
        const updates = {};

        if ((existing.email || "") !== (user.email || "")) updates.email = user.email || "";
        const displayName = existing.nickname || existing.displayName || user.displayName || "";
        if (existing.displayName !== displayName) updates.displayName = displayName;
        if (typeof existing.photoURL !== "string") updates.photoURL = user.photoURL || "";
        if ((existing.role || DEFAULT_ROLE) !== resolvedRole) updates.role = resolvedRole;

        if (Object.keys(updates).length) {
          transaction.set(docRef, updates, { merge: true });
        }

        return { uid: user.uid, ...existing, ...updates, role: resolvedRole };
      }

      const resolvedRole = resolveRoleForUser(user, DEFAULT_ROLE);
      const profile = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        nickname: "",
        subscription: { status: "free" },
        role: resolvedRole,
        createdAt: getServerTimestamp(),
      };
      transaction.set(docRef, profile);
      return profile;
    });
    await syncAuthProfile(user, profile);
    return profile;
  }

  async function getUserProfile(uid) {
    if (!uid) return null;
    const snapshot = await db.collection("users").doc(uid).get();
    return snapshot.exists ? { uid, ...snapshot.data() } : null;
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
    ensureUserProfile,
    getUserProfile,
  };
}
