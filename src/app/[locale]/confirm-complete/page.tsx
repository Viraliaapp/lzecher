import { getTranslations } from "next-intl/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CheckCircle } from "lucide-react";

export default async function ConfirmCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; name?: string }>;
}) {
  const params = await searchParams;
  const status = params.status || "success";
  const name = params.name || "";

  return (
    <>
      <Navbar />
      <main className="bg-cream min-h-screen flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <div className="rounded-2xl border border-gold/10 bg-white p-8 sm:p-12 shadow-sm">
            <div className="flex justify-center mb-6">
              <YahrzeitCandle size="md" />
            </div>

            {status === "success" && (
              <>
                <div className="flex justify-center mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <h1 className="font-heading text-2xl font-bold text-navy mb-2">
                  <ConfirmTitle status="success" />
                </h1>
                {name && <p className="text-sm text-muted mb-2">{name}</p>}
                <p className="text-muted leading-relaxed">
                  <ConfirmMessage status="success" />
                </p>
              </>
            )}
            {status === "already_complete" && (
              <>
                <div className="flex justify-center mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
                    <CheckCircle className="h-6 w-6 text-gold-deep" />
                  </div>
                </div>
                <h1 className="font-heading text-2xl font-bold text-navy mb-2">
                  <ConfirmTitle status="already" />
                </h1>
                {name && <p className="text-sm text-muted mb-2">{name}</p>}
                <p className="text-muted leading-relaxed">
                  <ConfirmMessage status="already" />
                </p>
              </>
            )}
            {status === "expired" && (
              <>
                <h1 className="font-heading text-2xl font-bold text-navy mb-2">
                  <ConfirmTitle status="expired" />
                </h1>
                <p className="text-muted leading-relaxed">
                  <ConfirmMessage status="expired" />
                </p>
              </>
            )}
            {(status === "not_found" || status === "error") && (
              <>
                <h1 className="font-heading text-2xl font-bold text-navy mb-2">
                  <ConfirmTitle status="error" />
                </h1>
                <p className="text-muted leading-relaxed">
                  <ConfirmMessage status="error" />
                </p>
              </>
            )}

            <div className="flex items-center justify-center gap-3 my-6">
              <div className="h-px flex-1 bg-gold/20" />
              <span className="text-gold/50 text-xs">&#x2727;</span>
              <div className="h-px flex-1 bg-gold/20" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ConfirmCTA type="memorials" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="sm">
                  <ConfirmCTA type="dashboard" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

async function ConfirmTitle({ status }: { status: string }) {
  const t = await getTranslations("memorial");
  if (status === "success") return <>{t("chizukTitle")}</>;
  if (status === "already") return <>{t("alreadyCompleted")}</>;
  if (status === "expired") return <>{t("tokenExpired")}</>;
  return <>{t("completeError")}</>;
}

async function ConfirmMessage({ status }: { status: string }) {
  const t = await getTranslations("memorial");
  if (status === "success") return <>{t("confirmCompleteMessage")}</>;
  if (status === "already") return <>{t("alreadyCompleted")}</>;
  if (status === "expired") return <>{t("tokenExpired")}</>;
  return <>{t("completeError")}</>;
}

async function ConfirmCTA({ type }: { type: string }) {
  const t = await getTranslations("common");
  if (type === "memorials") return <>{t("memorials")}</>;
  return <>{t("dashboard")}</>;
}
