"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Mail, ShieldCheck } from "lucide-react";

interface SoftLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
  onAnonymousClaim: () => void;
  locale?: string;
}

type ModalState = "idle" | "loading" | "sent";

export function SoftLoginModal({
  open,
  onOpenChange,
  onAuthenticated,
  onAnonymousClaim,
  locale = "en",
}: SoftLoginModalProps) {
  const t = useTranslations("softLogin");
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<ModalState>("idle");
  const [error, setError] = React.useState<string | null>(null);

  // Store current URL so we can return here after magic link auth
  React.useEffect(() => {
    if (open && typeof window !== "undefined") {
      sessionStorage.setItem("softLoginReturnTo", window.location.href);
    }
  }, [open]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setState("idle");
      setEmail("");
      setError(null);
    }
  }, [open]);

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;

    setState("loading");
    setError(null);

    try {
      const res = await fetch("/api/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send link");
      }

      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link. Please try again.");
      setState("idle");
    }
  }

  function handleAnonymous() {
    onOpenChange(false);
    onAnonymousClaim();
  }

  const promises = [
    t("promise1"),
    t("promise2"),
    t("promise3"),
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {state === "sent" ? (
          <SentState email={email} t={t} />
        ) : (
          <>
            <DialogHeader className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
                <Mail className="h-5 w-5 text-gold" />
              </div>
              <DialogTitle className="text-center text-xl">
                {t("title")}
              </DialogTitle>
              <DialogDescription className="text-center text-sm leading-relaxed text-navy/70">
                {t("body")}
              </DialogDescription>
            </DialogHeader>

            {/* Promise list */}
            <ul className="space-y-2 rounded-xl bg-navy/[0.03] px-4 py-3">
              {promises.map((promise, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-navy/60">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                  <span>{promise}</span>
                </li>
              ))}
            </ul>

            {/* Email form */}
            <form onSubmit={handleSendLink} className="space-y-3">
              <Input
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                disabled={state === "loading"}
              />

              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}

              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={state === "loading" || !email.trim()}
                >
                  {state === "loading" ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {t("sendLink")}
                    </span>
                  ) : (
                    t("sendLink")
                  )}
                </Button>

                <button
                  type="button"
                  onClick={handleAnonymous}
                  className="mt-1 text-center text-xs text-navy/40 underline underline-offset-2 hover:text-navy/60 transition-colors"
                >
                  {t("orAnonymous")}
                </button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SentState({
  email,
  t,
}: {
  email: string;
  t: ReturnType<typeof useTranslations<"softLogin">>;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
        <CheckCircle className="h-7 w-7 text-green-600" />
      </div>
      <DialogHeader className="space-y-2">
        <DialogTitle className="text-xl">{t("checkEmail")}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-navy/70">
          {t("checkEmailDesc").replace("{email}", email)}
        </DialogDescription>
      </DialogHeader>
      <p className="text-xs text-navy/40">{t("anonymousNote")}</p>
    </div>
  );
}
