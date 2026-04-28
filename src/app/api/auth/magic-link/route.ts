import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, link, locale = "en" } = await request.json();

    if (!email || !link) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const subjects: Record<string, string> = {
      en: "Sign in to Lzecher",
      he: "התחברות ל-Lzecher",
      es: "Iniciar sesion en Lzecher",
      fr: "Connexion a Lzecher",
    };

    const { data, error } = await resend.emails.send({
      from: "Lzecher <noreply@lzecher.com>",
      to: email,
      subject: subjects[locale] || subjects.en,
      html: `
        <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #0F1B2D; font-size: 28px; margin: 0;">Lzecher</h1>
            <p style="color: #C9A961; font-size: 14px; margin: 4px 0 0;">Memorial Learning Platform</p>
          </div>
          <div style="background: #FAF6EC; border-radius: 12px; padding: 32px; text-align: center;">
            <p style="color: #2A2D34; font-size: 16px; margin: 0 0 24px;">
              ${locale === "he" ? "לחץ על הכפתור להתחברות" : "Click the button below to sign in"}
            </p>
            <a href="${link}" style="display: inline-block; background: #C9A961; color: #0F1B2D; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
              ${locale === "he" ? "התחבר" : "Sign In"}
            </a>
            <p style="color: #6B6F76; font-size: 12px; margin: 24px 0 0;">
              ${locale === "he" ? "הקישור תקף ל-15 דקות" : "This link expires in 15 minutes"}
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
