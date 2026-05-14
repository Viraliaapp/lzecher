"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent } from "@/components/ui/card";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type State = "loading" | "success" | "error";

export default function AutoSigninPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      setErrorMsg(t("autoSigninNoToken") || "No sign-in token provided");
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/auth/custom-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "token rejected");
        }
        const { customToken, redirect } = await r.json();
        await signInWithCustomToken(auth, customToken);
        // Set cookie so middleware-protected routes accept the session
        document.cookie = "__session=1; path=/; max-age=2592000; samesite=lax";
        setState("success");
        // Brief pause so user sees success state, then redirect
        setTimeout(() => {
          if (redirect) {
            window.location.href = redirect;
          } else {
            router.push("/dashboard" as "/dashboard");
          }
        }, 800);
      } catch (err) {
        console.error("[auto-signin] failed:", err);
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : "sign-in failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-16">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <YahrzeitCandle size="md" />
          </div>
          {state === "loading" && (
            <>
              <Spinner className="mx-auto h-8 w-8" />
              <p className="text-sm text-muted">{t("autoSigninWorking") || "Signing you in…"}</p>
            </>
          )}
          {state === "success" && (
            <>
              <h1 className="font-heading text-xl text-navy">{t("welcomeBack")}</h1>
              <p className="text-sm text-muted">{t("autoSigninSuccess") || "Taking you to your dashboard…"}</p>
            </>
          )}
          {state === "error" && (
            <>
              <h1 className="font-heading text-xl text-navy">{t("autoSigninFailed") || "Could not sign you in"}</h1>
              <p className="text-sm text-muted">{errorMsg}</p>
              <Link href={"/login" as "/login"}>
                <Button>{t("signInTitle")}</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
