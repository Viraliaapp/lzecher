"use client";

import { useState, useEffect } from "react";
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
import { db } from "@/lib/firebase/config";

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

  // Handle magic link completion
  useEffect(() => {
    if (
      searchParams.get("finishSignIn") &&
      isMagicLinkSignIn(window.location.href)
    ) {
      const storedEmail =
        window.localStorage.getItem("lzecher_email_for_signin") || "";
      if (storedEmail) {
        setCompleting(true);
        completeMagicLinkSignIn(storedEmail, window.location.href)
          .then(async (cred) => {
            await ensureUserDoc(cred.user.uid, cred.user.email);
            toast.success(t("welcomeBack"));
          })
          .catch(() => {
            toast.error(t("linkExpired"));
            setCompleting(false);
          });
      }
    }
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
