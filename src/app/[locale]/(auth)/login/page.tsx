"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  sendMagicLink,
  isMagicLinkSignIn,
  completeMagicLinkSignIn,
} from "@/lib/firebase/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BookOpen, Mail } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";

export default function LoginPage() {
  const t = useTranslations("auth");
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function ensureUserDoc(uid: string, userEmail: string | null) {
    const ref = doc(db, "lzecher_users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: uid,
        uid,
        email: userEmail,
        displayName: null,
        photoURL: null,
        createdAt: Date.now(),
        language: locale,
        totalClaimed: 0,
        totalCompleted: 0,
        projectsCreated: 0,
        projectsContributed: [],
      });
    }
  }

  // Handle magic link completion — ref guard prevents StrictMode double-invoke
  const signInAttemptedRef = useRef(false);
  useEffect(() => {
    if (signInAttemptedRef.current) return;
    if (!searchParams.get("finishSignIn")) return;
    if (!isMagicLinkSignIn(window.location.href)) return;
    signInAttemptedRef.current = true;

    (async () => {
      // Strategy: the magic-link redirect URL embeds a signed token (?e=...) carrying
      // the requesting email. Verify it server-side and use that email to complete
      // sign-in without prompting the user. Falls back to localStorage, then to
      // a prompt only if both are absent (truly cross-device with no token).
      let emailToUse = "";

      const tokenE = searchParams.get("e");
      if (tokenE) {
        try {
          const r = await fetch("/api/auth/verify-email-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: tokenE }),
          });
          if (r.ok) {
            const data = await r.json();
            if (data.email) emailToUse = data.email;
          }
        } catch (e) {
          console.warn("[login] could not verify embedded email token:", e);
        }
      }

      if (!emailToUse) {
        emailToUse = window.localStorage.getItem("lzecher_email_for_signin") || "";
      }

      if (!emailToUse) {
        // Last-resort: ask. Should now be very rare (only if token was stripped
        // AND user is on a different browser).
        emailToUse = window.prompt(t("enterEmailPrompt")) || "";
        if (!emailToUse) {
          signInAttemptedRef.current = false;
          return;
        }
      }

      setCompleting(true);
      try {
        const cred = await completeMagicLinkSignIn(emailToUse, window.location.href);
        await ensureUserDoc(cred.user.uid, cred.user.email);
        toast.success(t("welcomeBack"));
      } catch (err) {
        console.error("Magic link verify failed:", err);
        if (!auth.currentUser) {
          toast.error(t("linkExpired"));
        }
        setCompleting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      const redirect = searchParams.get("redirect") || "/dashboard";
      router.push(redirect as "/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  async function handleSendLink() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendMagicLink(trimmed, locale);
      setMagicSent(true);
    } catch (err) {
      console.error("Magic link error:", err);
      toast.error(t("errorSendingLink"));
    } finally {
      setSending(false);
    }
  }

  if (loading || completing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-16 bg-cream">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 mb-4">
              <BookOpen className="h-6 w-6 text-gold-deep" />
            </div>
            <CardTitle className="text-2xl">{t("signInTitle")}</CardTitle>
            <CardDescription>{t("signInSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {magicSent ? (
              /* ── Success state ── */
              <div className="text-center py-4">
                <Mail className="h-14 w-14 text-gold mx-auto mb-4" />
                <h3 className="font-heading text-lg font-semibold text-navy mb-2">
                  {t("checkEmail")}
                </h3>
                <p className="text-sm text-muted mb-6 leading-relaxed">
                  {t("magicLinkInstructions", { email: email.trim() })}
                </p>
                <button
                  onClick={() => {
                    setMagicSent(false);
                    setEmail("");
                  }}
                  className="text-sm text-gold hover:text-gold-deep font-medium transition-colors"
                >
                  {t("useDifferentEmail")}
                </button>
              </div>
            ) : (
              /* ── Email input state ── */
              <div className="space-y-4">
                <div>
                  <Input
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendLink()}
                    autoFocus
                    autoComplete="email"
                    dir="ltr"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSendLink}
                  disabled={sending || !email.trim()}
                >
                  {sending ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      {t("sendSignInLink")}
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted leading-relaxed">
                  {t("noPasswordNeeded")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
