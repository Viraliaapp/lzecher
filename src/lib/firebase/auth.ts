import {
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

export async function sendMagicLink(email: string, locale: string = "en") {
  const res = await fetch("/api/send-magic-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, locale }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to send magic link");
  }

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
