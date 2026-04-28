"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { signupWithEmail, loginWithGoogle } from "@/lib/firebase/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default function SignupPage() {
  const t = useTranslations("auth");
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
  }, [user, loading]);

  async function ensureUserDoc(uid: string, email: string | null, displayName: string | null) {
    const ref = doc(db, "lzecher_users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: uid,
        uid,
        email,
        displayName,
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

  async function handleSignup() {
    if (!email.trim() || !password.trim()) return;
    if (password.length < 6) {
      toast.error(t("passwordTooShort"));
      return;
    }
    setCreating(true);
    try {
      const cred = await signupWithEmail(email, password);
      await ensureUserDoc(cred.user.uid, email, name || null);
      toast.success(t("accountCreated"));
    } catch {
      toast.error(t("signupError"));
    } finally {
      setCreating(false);
    }
  }

  async function handleGoogle() {
    try {
      const cred = await loginWithGoogle();
      await ensureUserDoc(cred.user.uid, cred.user.email, cred.user.displayName);
      toast.success(t("welcomeBack"));
    } catch {
      toast.error(t("googleError"));
    }
  }

  if (loading) {
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
            <CardTitle className="text-2xl">{t("signupTitle")}</CardTitle>
            <CardDescription>{t("signupSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleGoogle}>
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {t("continueWithGoogle")}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-navy/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted">{t("or")}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
              />
              <Button className="w-full" onClick={handleSignup} disabled={creating}>
                {creating ? <Spinner className="h-4 w-4" /> : t("createAccount")}
              </Button>
            </div>

            <p className="text-center text-sm text-muted">
              {t("hasAccount")}{" "}
              <Link href="/login" className="text-gold hover:text-gold-deep font-medium">
                {t("signInLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
