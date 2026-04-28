import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const SUBJECTS: Record<string, string> = {
  en: "Sign in to Lzecher",
  he: "התחברות ל-Lzecher",
  es: "Iniciar sesion en Lzecher",
  fr: "Connexion a Lzecher",
};

const BUTTON_TEXT: Record<string, string> = {
  en: "Sign in to Lzecher",
  he: "התחבר ל-Lzecher",
  es: "Iniciar sesion",
  fr: "Se connecter",
};

const EXPIRES_TEXT: Record<string, string> = {
  en: "This link expires in 1 hour. If you didn't request this, you can safely ignore this email.",
  he: "הקישור תקף לשעה אחת. אם לא ביקשת את זה, ניתן להתעלם מהודעה זו.",
  es: "Este enlace caduca en 1 hora. Si no lo solicitaste, puedes ignorar este correo.",
  fr: "Ce lien expire dans 1 heure. Si vous ne l'avez pas demande, vous pouvez ignorer cet e-mail.",
};

const TAGLINE: Record<string, string> = {
  en: "Honoring memory through Torah learning",
  he: "לעילוי נשמת — לזכר עולם יהיה צדיק",
  es: "Honrando la memoria a traves del estudio de la Tora",
  fr: "Honorer la memoire par l'etude de la Torah",
};

export async function POST(request: NextRequest) {
  try {
    const { email, locale = "en" } = await request.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lzecher.com";

    // Generate the sign-in link server-side using Firebase Admin
    const adminAuth = getAdminAuth();
    const actionCodeSettings = {
      url: `${baseUrl}/${locale}/login?finishSignIn=true`,
      handleCodeInApp: true,
    };

    const signInLink = await adminAuth.generateSignInWithEmailLink(
      email,
      actionCodeSettings
    );

    // Send branded email via Resend
    const subject = SUBJECTS[locale] || SUBJECTS.en;
    const buttonText = BUTTON_TEXT[locale] || BUTTON_TEXT.en;
    const expiresText = EXPIRES_TEXT[locale] || EXPIRES_TEXT.en;
    const tagline = TAGLINE[locale] || TAGLINE.en;
    const dir = locale === "he" ? "rtl" : "ltr";

    const { error } = await resend.emails.send({
      from: "Lzecher <noreply@lzecher.com>",
      to: email,
      subject,
      html: `
<!DOCTYPE html>
<html dir="${dir}" lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6EC;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EC;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
        <!-- Header -->
        <tr><td align="center" style="padding-bottom:32px;">
          <div style="display:inline-block;width:48px;height:48px;background:rgba(201,169,97,0.1);border-radius:12px;line-height:48px;text-align:center;">
            <span style="font-size:24px;color:#C9A961;">&#x2727;</span>
          </div>
          <h1 style="margin:12px 0 0;font-size:28px;color:#0F1B2D;font-weight:700;letter-spacing:-0.5px;">Lzecher</h1>
          <p style="margin:4px 0 0;font-size:13px;color:#C9A961;letter-spacing:1px;">${tagline}</p>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#FFFFFF;border-radius:16px;padding:40px 32px;border:1px solid rgba(15,27,45,0.05);">
          <p style="margin:0 0 24px;font-size:16px;color:#2A2D34;line-height:1.6;text-align:center;">
            ${locale === "he" ? "לחץ על הכפתור למטה כדי להתחבר" : locale === "es" ? "Haz clic en el boton de abajo para iniciar sesion" : locale === "fr" ? "Cliquez sur le bouton ci-dessous pour vous connecter" : "Click the button below to sign in"}
          </p>

          <!-- Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${signInLink}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#C9A961,#D4B679);color:#0F1B2D;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;font-family:system-ui,sans-serif;letter-spacing:0.3px;">
                ${buttonText}
              </a>
            </td></tr>
          </table>

          <!-- Expires note -->
          <p style="margin:24px 0 0;font-size:12px;color:#6B6F76;line-height:1.5;text-align:center;">
            ${expiresText}
          </p>

          <!-- Fallback link -->
          <p style="margin:16px 0 0;font-size:11px;color:#6B6F76;text-align:center;word-break:break-all;">
            ${locale === "he" ? "אם הכפתור לא עובד, העתק את הקישור הזה:" : "If the button doesn't work, copy this link:"}<br>
            <a href="${signInLink}" style="color:#C9A961;">${signInLink}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:#6B6F76;">&copy; ${new Date().getFullYear()} Lzecher</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Magic link error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
