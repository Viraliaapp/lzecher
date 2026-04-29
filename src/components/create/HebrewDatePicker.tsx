"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { HDate } from "@hebcal/hdate";

interface HebrewDatePickerProps {
  label: string;
  gregorianValue: string;
  hebrewValue: string;
  onGregorianChange: (val: string) => void;
  onHebrewChange: (val: string) => void;
  required?: boolean;
}

function gregorianToHebrew(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return "";
    const hd = new HDate(new Date(year, month - 1, day));
    return hd.renderGematriya();
  } catch {
    return "";
  }
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayHebrew(): string {
  try {
    return new HDate().renderGematriya();
  } catch {
    return "";
  }
}

export function HebrewDatePicker({
  label,
  gregorianValue,
  hebrewValue,
  onGregorianChange,
  onHebrewChange,
  required,
}: HebrewDatePickerProps) {
  const t = useTranslations("create");
  const [localHebrew, setLocalHebrew] = useState(hebrewValue || "");

  // Sync Hebrew display when Gregorian changes
  const syncFromGregorian = useCallback(
    (greg: string) => {
      const heb = gregorianToHebrew(greg);
      if (heb) {
        setLocalHebrew(heb);
        onHebrewChange(heb);
      }
    },
    [onHebrewChange]
  );

  // When parent gregorianValue changes externally, sync Hebrew
  useEffect(() => {
    if (gregorianValue && !localHebrew) {
      syncFromGregorian(gregorianValue);
    }
    // Only run on mount or when gregorianValue changes externally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGregorianChange(val: string) {
    onGregorianChange(val);
    if (val) {
      const heb = gregorianToHebrew(val);
      if (heb) {
        setLocalHebrew(heb);
        onHebrewChange(heb);
      }
    }
  }

  function handleHebrewChange(val: string) {
    setLocalHebrew(val);
    onHebrewChange(val);
    // We don't auto-convert Hebrew text → Gregorian since
    // parsing free-form Hebrew date text is unreliable.
    // The Hebrew field stores whatever the user types or what was auto-filled.
  }

  function handleToday() {
    const greg = todayISO();
    const heb = todayHebrew();
    onGregorianChange(greg);
    setLocalHebrew(heb);
    onHebrewChange(heb);
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-navy block">
        {label} {required && <span className="text-gold">*</span>}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gregorian */}
        <div>
          <label className="text-xs text-muted mb-1 block">
            {t("gregorianLabel")}
          </label>
          <Input
            type="date"
            value={gregorianValue}
            onChange={(e) => handleGregorianChange(e.target.value)}
          />
        </div>

        {/* Hebrew — editable text field */}
        <div>
          <label className="text-xs text-muted mb-1 block" dir="rtl">
            {t("hebrewLabel")}
          </label>
          <Input
            dir="rtl"
            value={localHebrew}
            onChange={(e) => handleHebrewChange(e.target.value)}
            placeholder="יום חודש שנה"
          />
        </div>
      </div>

      {/* Today quick-fill */}
      <button
        type="button"
        onClick={handleToday}
        className="text-xs text-gold hover:text-gold-deep font-medium transition-colors"
      >
        {t("todayButton")}
      </button>
    </div>
  );
}
