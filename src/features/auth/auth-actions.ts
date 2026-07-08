import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { ref, serverTimestamp, set, get } from "firebase/database";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";

export async function signUp(email: string, password: string, displayName: string) {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });

  const db = getFirebaseDb();
  // First user becomes admin bootstrap.
  const usersSnap = await get(ref(db, "users"));
  const isFirst = !usersSnap.exists();

  await set(ref(db, `users/${cred.user.uid}`), {
    email,
    displayName: displayName || email,
    role: isFirst ? "admin" : "user",
    createdAt: serverTimestamp(),
  });
  return cred.user;
}

export async function signIn(email: string, password: string) {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOutUser() {
  await signOut(getFirebaseAuth());
}

export async function sendReset(email: string) {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}
