import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "./config";

function setAuthCookie(present: boolean) {
  if (typeof document === "undefined") return;
  document.cookie = present
    ? "__session=1; path=/; max-age=2592000; samesite=lax"
    : "__session=; path=/; max-age=0; samesite=lax";
}

const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  setAuthCookie(true);
  return cred;
}

export async function loginWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  setAuthCookie(true);
  return cred;
}

export async function signupWithEmail(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  setAuthCookie(true);
  return cred;
}

export async function sendMagicLink(email: string, locale: string = "en") {
  const actionCodeSettings = {
    url: `${window.location.origin}/${locale}/login?finishSignIn=true`,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem("lzecher_email_for_signin", email);
}

export function isMagicLinkSignIn(url: string) {
  return isSignInWithEmailLink(auth, url);
}

export async function completeMagicLinkSignIn(email: string, url: string) {
  const cred = await signInWithEmailLink(auth, email, url);
  setAuthCookie(true);
  window.localStorage.removeItem("lzecher_email_for_signin");
  return cred;
}

export async function logout() {
  await signOut(auth);
  setAuthCookie(false);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export type { User };
