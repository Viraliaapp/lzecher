export const LZECHER_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@lzecher.com";

export function lzecherEmailFrom(name = "Lzecher") {
  return `${name} <${LZECHER_FROM_EMAIL}>`;
}

export function friendlyEmailError(locale: string, error?: string | null) {
  const message = String(error || "");
  if (locale !== "he") return message;

  if (message.includes("only send testing emails")) {
    return "מערכת האימייל חסמה את השליחה כי היא נשלחה מכתובת בדיקה. השליחה עודכנה לכתובת הדומיין המאומתת.";
  }
  if (message.includes("Too many requests") || message.includes("requests per second")) {
    return "מערכת האימייל חסמה זמנית את השליחה כי נשלחו יותר מדי הודעות בבת אחת. התור עודכן לשליחה מדורגת.";
  }
  if (message.includes("Invalid `to` field") || message.includes("email@example.com")) {
    return "כתובת האימייל של הנמען אינה תקינה. יש לתקן את הכתובת לפני שליחה חוזרת.";
  }

  return message
    .replaceAll("Error:", "שגיאה:")
    .replaceAll("Failed to send message", "לא ניתן לשלוח את ההודעה");
}
