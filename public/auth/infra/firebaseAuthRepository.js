import { DEFAULT_ROLE } from "../domain/roles.js";

export function createFirebaseAuthRepository({ firebaseApp = window.firebase, db = window.db } = {}) {
  if (!firebaseApp || !firebaseApp.auth) {
    throw new Error("Firebase Auth SDK is not available");
  }
  if (!db) {
    throw new Error("Firestore db is not available on window.db");
  }

  const auth = firebaseApp.auth();

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
    deleteAccount,
    onAuthStateChanged,
    ensureUserProfile,
    getUserProfile,
  };
}
