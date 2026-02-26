import { DEFAULT_ROLE } from "../domain/roles.js";

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

  async function signInWithProvider(providerId) {
    if (providerId === "google") {
      const provider = new firebaseApp.auth.GoogleAuthProvider();
      return auth.signInWithPopup(provider);
    }
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  function signInWithEmail(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
  }

  function signUpWithEmail(email, password) {
    return auth.createUserWithEmailAndPassword(email, password);
  }

  function signOut() {
    return auth.signOut();
  }

  function normalizeNickname(value) {
    return (value || "").trim().toLowerCase();
  }

  async function checkNicknameAvailability(nickname) {
    const key = normalizeNickname(nickname);
    if (!key) {
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
      throw new Error("Not authenticated");
    }

    const updates = {};
    const profileRef = db.collection("users").doc(user.uid);
    const profileSnap = await profileRef.get();
    const currentProfile = profileSnap.exists ? profileSnap.data() : {};
    const currentNickname = currentProfile.nickname || "";
    const lastNicknameUpdatedAt = currentProfile.nicknameUpdatedAt;
    const now = Date.now();
    const cooldownMs = 24 * 60 * 60 * 1000;

    if (typeof nickname === "string") {
      const key = normalizeNickname(nickname);
      if (!key) {
        const error = new Error("Invalid nickname");
        error.code = "auth/invalid-nickname";
        throw error;
      }
      const lastTs = lastNicknameUpdatedAt && typeof lastNicknameUpdatedAt.toMillis === "function"
        ? lastNicknameUpdatedAt.toMillis()
        : (lastNicknameUpdatedAt ? new Date(lastNicknameUpdatedAt).getTime() : null);
      if (lastTs && now - lastTs < cooldownMs && normalizeNickname(currentNickname) !== key) {
        const error = new Error("Nickname change cooldown");
        error.code = "auth/nickname-cooldown";
        error.retryAfterMs = cooldownMs - (now - lastTs);
        throw error;
      }
      const availability = await checkNicknameAvailability(nickname);
      if (!availability.available) {
        const error = new Error("Nickname already taken");
        error.code = "auth/nickname-taken";
        throw error;
      }
      if (normalizeNickname(currentNickname) !== key) {
        if (currentNickname) {
          await nicknamesCollection.doc(normalizeNickname(currentNickname)).delete().catch(() => {});
        }
        await nicknamesCollection.doc(key).set({
          uid: user.uid,
          nickname,
          updatedAt: getServerTimestamp(),
        });
      }
      updates.nickname = nickname;
      updates.nicknameUpdatedAt = getServerTimestamp();
      await user.updateProfile({ displayName: nickname });
    }

    if (typeof photoURL === "string") {
      updates.photoURL = photoURL;
      await user.updateProfile({ photoURL: photoURL || "" });
    }

    if (Object.keys(updates).length) {
      await profileRef.set(updates, { merge: true });
    }

    return getUserProfile(user.uid);
  }

  async function uploadAvatar(file) {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Not authenticated");
    }
    if (!firebaseApp.storage) {
      throw new Error("Firebase Storage SDK is not available");
    }
    if (!file) {
      throw new Error("No file provided");
    }
    const storage = firebaseApp.storage();
    const ref = storage.ref().child(`avatars/${user.uid}/profile.jpg`);
    const snapshot = await ref.put(file, {
      contentType: file.type || "image/jpeg",
      cacheControl: "public,max-age=31536000",
    });
    return snapshot.ref.getDownloadURL();
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
    } else if (providerIds.includes("google.com")) {
      const provider = new firebaseApp.auth.GoogleAuthProvider();
      await user.reauthenticateWithPopup(provider);
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
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      return { uid: user.uid, ...snapshot.data() };
    }

    const profile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      nickname: "",
      subscription: { status: "free" },
      role: DEFAULT_ROLE,
      createdAt: getServerTimestamp(),
    };
    await docRef.set(profile);
    return profile;
  }

  async function getUserProfile(uid) {
    if (!uid) return null;
    const snapshot = await db.collection("users").doc(uid).get();
    return snapshot.exists ? { uid, ...snapshot.data() } : null;
  }

  return {
    signInWithProvider,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    checkNicknameAvailability,
    updateProfile,
    uploadAvatar,
    deleteAccount,
    onAuthStateChanged,
    ensureUserProfile,
    getUserProfile,
  };
}
