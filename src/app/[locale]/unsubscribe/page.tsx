import { Suspense } from "react";
import { getAdminDb } from "@/lib/firebase/admin";
import UnsubscribeClient from "./UnsubscribeClient";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

// ── HMAC verification ─────────────────────────────────────────────────────────

async function verifyUnsubscribeToken(
  token: string
): Promise<{ userId: string; claimId: string } | null> {
  try {
    const [encoded, sigB64] = token.split(".");
    if (!encoded || !sigB64) return null;

    const secret = process.env.CRON_SECRET || "fallback-secret";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sig = Buffer.from(sigB64, "base64url");
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sig,
      new TextEncoder().encode(encoded)
    );

    if (!valid) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));

    // Check expiry
    if (payload.exp && Date.now() > payload.exp) return null;

    return { userId: payload.userId, claimId: payload.claimId };
  } catch {
    return null;
  }
}

// ── Page (server component) ───────────────────────────────────────────────────

export default async function UnsubscribePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { token } = await searchParams;

  if (!token) {
    return <ErrorState locale={locale} reason="missing" />;
  }

  const verified = await verifyUnsubscribeToken(token);
  if (!verified) {
    return <ErrorState locale={locale} reason="invalid" />;
  }

  const { userId, claimId } = verified;

  // Load claim data
  const db = getAdminDb();
  const claimSnap = await db.collection("lzecher_claims").doc(claimId).get();

  if (!claimSnap.exists) {
    return <ErrorState locale={locale} reason="notFound" />;
  }

  const claim = claimSnap.data()!;

  // Security: token user must match claim owner
  if (claim.userId !== userId) {
    return <ErrorState locale={locale} reason="invalid" />;
  }

  // Load project for honoree name
  let honoreeName = "";
  let projectSlug = "";
  if (claim.projectId) {
    try {
      const projectSnap = await db
        .collection("lzecher_projects")
        .doc(claim.projectId)
        .get();
      if (projectSnap.exists) {
        const proj = projectSnap.data()!;
        honoreeName = proj.nameHebrew || proj.nameEnglish || "";
        projectSlug = proj.slug || "";
      }
    } catch {
      // Non-fatal
    }
  }

  const currentPreferences: string[] = claim.reminderPreferences ?? [];

  return (
    <Suspense fallback={null}>
      <UnsubscribeClient
        claimId={claimId}
        token={token}
        locale={locale}
        honoreeName={honoreeName}
        commitmentDesc={claim.reference || ""}
        projectSlug={projectSlug}
        currentPreferences={currentPreferences}
      />
    </Suspense>
  );
}

// ── Error states ──────────────────────────────────────────────────────────────

const ERROR_COPY: Record<
  string,
  Record<string, { title: string; body: string }>
> = {
  missing: {
    en: { title: "Invalid link", body: "This unsubscribe link is missing required information." },
    he: { title: "קישור לא תקין", body: "קישור ביטול ההרשמה חסר מידע נדרש." },
    es: { title: "Enlace invalido", body: "Este enlace de baja no contiene la informacion necesaria." },
    fr: { title: "Lien invalide", body: "Ce lien de desabonnement ne contient pas les informations requises." },
  },
  invalid: {
    en: { title: "Link expired or invalid", body: "This unsubscribe link has expired or is not valid. Please use the link from a recent email." },
    he: { title: "הקישור פג תוקף", body: "קישור ביטול ההרשמה פג תוקפו או אינו תקין. אנא השתמש בקישור ממייל עדכני." },
    es: { title: "Enlace caducado o invalido", body: "Este enlace de baja ha caducado o no es valido. Usa el enlace de un correo reciente." },
    fr: { title: "Lien expire ou invalide", body: "Ce lien de desabonnement a expire ou n'est pas valide. Utilisez le lien d'un e-mail recent." },
  },
  notFound: {
    en: { title: "Commitment not found", body: "This commitment may have already been removed." },
    he: { title: "ההתחייבות לא נמצאה", body: "ייתכן שהתחייבות זו כבר הוסרה." },
    es: { title: "Compromiso no encontrado", body: "Es posible que este compromiso ya haya sido eliminado." },
    fr: { title: "Engagement introuvable", body: "Cet engagement a peut-etre deja ete supprime." },
  },
};

function ErrorState({ locale, reason }: { locale: string; reason: string }) {
  const copy =
    ERROR_COPY[reason]?.[locale] ||
    ERROR_COPY[reason]?.en ||
    ERROR_COPY.invalid.en;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-16 text-center">
      <div className="max-w-sm space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy/5">
          <span className="text-2xl text-gold">✦</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-navy">{copy.title}</h1>
        <p className="text-sm leading-relaxed text-navy/60">{copy.body}</p>
      </div>
    </main>
  );
}
