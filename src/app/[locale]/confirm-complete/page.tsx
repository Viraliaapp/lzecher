import { useTranslations } from "next-intl";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CheckCircle } from "lucide-react";

export default function ConfirmCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; name?: string }>;
}) {
  return <ConfirmCompleteContent searchParamsPromise={searchParams} />;
}

function ConfirmCompleteContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ status?: string; name?: string }>;
}) {
  // Use React.use() via server component
  return <ConfirmCompleteInner searchParamsPromise={searchParamsPromise} />;
}

async function ConfirmCompleteInner({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ status?: string; name?: string }>;
}) {
  const params = await searchParamsPromise;
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

            {status === "success" && <SuccessContent name={name} />}
            {status === "already_complete" && <AlreadyCompleteContent name={name} />}
            {status === "expired" && <ExpiredContent />}
            {status === "not_found" && <NotFoundContent />}
            {status === "error" && <ErrorContent />}

            <div className="flex items-center justify-center gap-3 my-6">
              <div className="h-px flex-1 bg-gold/20" />
              <span className="text-gold/50 text-xs">&#x2727;</span>
              <div className="h-px flex-1 bg-gold/20" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/">
                <Button variant="outline" size="sm">View memorials</Button>
              </Link>
              <Link href="/dashboard">
                <Button size="sm">My dashboard</Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function SuccessContent({ name }: { name: string }) {
  return (
    <>
      <div className="flex justify-center mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
      </div>
      <h1 className="font-heading text-2xl font-bold text-navy mb-2">Yasher Koach</h1>
      {name && (
        <p className="text-sm text-muted mb-2">{name}</p>
      )}
      <p className="text-muted leading-relaxed">
        Your learning has been marked complete. The zechus is eternal — each word of Torah creates
        light for the neshama.
      </p>
    </>
  );
}

function AlreadyCompleteContent({ name }: { name: string }) {
  return (
    <>
      <div className="flex justify-center mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
          <CheckCircle className="h-6 w-6 text-gold-deep" />
        </div>
      </div>
      <h1 className="font-heading text-2xl font-bold text-navy mb-2">Already Complete</h1>
      {name && (
        <p className="text-sm text-muted mb-2">{name}</p>
      )}
      <p className="text-muted leading-relaxed">
        This has already been marked as complete. Your zechus continues.
      </p>
    </>
  );
}

function ExpiredContent() {
  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-navy mb-2">Link Expired</h1>
      <p className="text-muted leading-relaxed">
        This link has expired. Please open your dashboard to mark this learning as complete.
      </p>
    </>
  );
}

function NotFoundContent() {
  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-navy mb-2">Not Found</h1>
      <p className="text-muted leading-relaxed">
        This claim could not be found. It may have been removed.
      </p>
    </>
  );
}

function ErrorContent() {
  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-navy mb-2">Something Went Wrong</h1>
      <p className="text-muted leading-relaxed">
        We couldn't process this request. Please try again from your dashboard.
      </p>
    </>
  );
}
