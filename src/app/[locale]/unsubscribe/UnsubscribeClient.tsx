"use client";

import * as React from "react";
import { CheckCircle, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── All supported reminder preference keys ────────────────────────────────────

const ALL_REMINDER_TYPES = [
  "confirmation",
  "halfway",
  "sevenDaysBefore",
  "threeDaysBefore",
  "oneDayBefore",
  "dailyReminder",
  "weeklyDigest",
] as const;

type ReminderKey = (typeof ALL_REMINDER_TYPES)[number];

// ── Copy per locale ───────────────────────────────────────────────────────────

interface LocaleCopy {
  title: string;
  subtitle: string;
  reminderLabels: Record<ReminderKey, string>;
  saveButton: string;
  saving: string;
  saved: string;
  saveError: string;
  honoring: string;
  commitment: string;
  allOff: string;
}

const COPY: Record<string, LocaleCopy> = {
  en: {
    title: "Reminder Preferences",
    subtitle: "Choose which reminders you'd like to receive for this commitment.",
    reminderLabels: {
      confirmation: "Confirmation (immediate)",
      halfway: "Halfway reminder",
      sevenDaysBefore: "7 days before deadline",
      threeDaysBefore: "3 days before deadline",
      oneDayBefore: "1 day before deadline",
      dailyReminder: "Daily reminders",
      weeklyDigest: "Weekly digest",
    },
    saveButton: "Save preferences",
    saving: "Saving...",
    saved: "Preferences saved",
    saveError: "Could not save. Please try again.",
    honoring: "Honoring",
    commitment: "Commitment",
    allOff: "Turn off all reminders",
  },
  he: {
    title: "העדפות תזכורות",
    subtitle: "בחר אילו תזכורות תרצה לקבל עבור התחייבות זו.",
    reminderLabels: {
      confirmation: "אישור (מיידי)",
      halfway: "תזכורת באמצע",
      sevenDaysBefore: "7 ימים לפני המועד",
      threeDaysBefore: "3 ימים לפני המועד",
      oneDayBefore: "יום לפני המועד",
      dailyReminder: "תזכורות יומיות",
      weeklyDigest: "סיכום שבועי",
    },
    saveButton: "שמור העדפות",
    saving: "שומר...",
    saved: "ההעדפות נשמרו",
    saveError: "לא ניתן לשמור. נסה שוב.",
    honoring: "לעילוי נשמת",
    commitment: "התחייבות",
    allOff: "כבה את כל התזכורות",
  },
  es: {
    title: "Preferencias de recordatorios",
    subtitle: "Elige que recordatorios deseas recibir para este compromiso.",
    reminderLabels: {
      confirmation: "Confirmacion (inmediata)",
      halfway: "Recordatorio a la mitad",
      sevenDaysBefore: "7 dias antes del plazo",
      threeDaysBefore: "3 dias antes del plazo",
      oneDayBefore: "1 dia antes del plazo",
      dailyReminder: "Recordatorios diarios",
      weeklyDigest: "Resumen semanal",
    },
    saveButton: "Guardar preferencias",
    saving: "Guardando...",
    saved: "Preferencias guardadas",
    saveError: "No se pudo guardar. Intentalo de nuevo.",
    honoring: "En honor a",
    commitment: "Compromiso",
    allOff: "Desactivar todos los recordatorios",
  },
  fr: {
    title: "Preferences de rappels",
    subtitle: "Choisissez les rappels que vous souhaitez recevoir pour cet engagement.",
    reminderLabels: {
      confirmation: "Confirmation (immediate)",
      halfway: "Rappel a mi-parcours",
      sevenDaysBefore: "7 jours avant l'echeance",
      threeDaysBefore: "3 jours avant l'echeance",
      oneDayBefore: "1 jour avant l'echeance",
      dailyReminder: "Rappels quotidiens",
      weeklyDigest: "Resume hebdomadaire",
    },
    saveButton: "Enregistrer les preferences",
    saving: "Enregistrement...",
    saved: "Preferences enregistrees",
    saveError: "Impossible d'enregistrer. Veuillez reessayer.",
    honoring: "En memoire de",
    commitment: "Engagement",
    allOff: "Desactiver tous les rappels",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface UnsubscribeClientProps {
  claimId: string;
  token: string;
  locale: string;
  honoreeName: string;
  commitmentDesc: string;
  projectSlug: string;
  currentPreferences: string[];
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function UnsubscribeClient({
  claimId,
  token,
  locale,
  honoreeName,
  commitmentDesc,
  currentPreferences,
}: UnsubscribeClientProps) {
  const copy = COPY[locale] || COPY.en;
  const isRtl = locale === "he";

  const [prefs, setPrefs] = React.useState<Set<string>>(
    new Set(currentPreferences)
  );
  const [saveState, setSaveState] = React.useState<SaveState>("idle");

  function toggle(key: ReminderKey) {
    setPrefs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setSaveState("idle");
  }

  function turnAllOff() {
    setPrefs(new Set());
    setSaveState("idle");
  }

  async function handleSave() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          claimId,
          reminderPreferences: Array.from(prefs),
        }),
      });

      if (!res.ok) {
        throw new Error("Server error");
      }

      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="flex min-h-screen flex-col items-center bg-cream px-4 py-16"
    >
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10">
            <Bell className="h-5 w-5 text-gold" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-navy">{copy.title}</h1>
          <p className="text-sm leading-relaxed text-navy/60">{copy.subtitle}</p>
        </div>

        {/* Context card */}
        {(honoreeName || commitmentDesc) && (
          <div className="rounded-xl border border-navy/10 bg-white p-4 space-y-1 text-sm">
            {honoreeName && (
              <p className="text-navy/50">
                <span className="font-medium text-navy/70">{copy.honoring}:</span>{" "}
                {honoreeName}
              </p>
            )}
            {commitmentDesc && (
              <p className="text-navy/50">
                <span className="font-medium text-navy/70">{copy.commitment}:</span>{" "}
                {commitmentDesc}
              </p>
            )}
          </div>
        )}

        {/* Toggles */}
        <div className="rounded-2xl border border-navy/10 bg-white divide-y divide-navy/5 overflow-hidden">
          {ALL_REMINDER_TYPES.map((key) => {
            const active = prefs.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={cn(
                  "w-full flex items-center justify-between px-5 py-4 text-sm transition-colors",
                  active
                    ? "bg-white hover:bg-gold/5"
                    : "bg-navy/[0.02] hover:bg-navy/5"
                )}
              >
                <span
                  className={cn(
                    "font-medium",
                    active ? "text-navy" : "text-navy/40 line-through"
                  )}
                >
                  {copy.reminderLabels[key]}
                </span>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                    active ? "bg-gold/10 text-gold" : "bg-navy/5 text-navy/30"
                  )}
                >
                  {active ? (
                    <Bell className="h-3.5 w-3.5" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleSave}
            className="w-full"
            disabled={saveState === "saving" || saveState === "saved"}
          >
            {saveState === "saving" ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {copy.saving}
              </span>
            ) : saveState === "saved" ? (
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {copy.saved}
              </span>
            ) : (
              copy.saveButton
            )}
          </Button>

          {saveState === "error" && (
            <p className="text-center text-xs text-red-600">{copy.saveError}</p>
          )}

          {prefs.size > 0 && (
            <button
              type="button"
              onClick={turnAllOff}
              className="w-full text-center text-xs text-navy/40 underline underline-offset-2 hover:text-navy/60 transition-colors"
            >
              {copy.allOff}
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-navy/30">
          Lzecher &nbsp;·&nbsp; lzecher.com
        </p>
      </div>
    </main>
  );
}
