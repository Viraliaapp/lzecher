"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HDate, gematriya, months } from "@hebcal/hdate";

interface HebrewDatePickerProps {
  label: string;
  gregorianValue: string;
  hebrewValue: string;
  onGregorianChange: (val: string) => void;
  onHebrewChange: (val: string) => void;
  required?: boolean;
  maxToday?: boolean;
}

// Month definitions in Hebrew calendar order (Tishrei-first civil order)
const MONTH_ORDER = [
  { key: "TISHREI", num: 7, he: "תשרי" },
  { key: "CHESHVAN", num: 8, he: "חשוון" },
  { key: "KISLEV", num: 9, he: "כסלו" },
  { key: "TEVET", num: 10, he: "טבת" },
  { key: "SHVAT", num: 11, he: "שבט" },
  { key: "ADAR_I", num: 12, he: "אדר א׳", leapOnly: true },
  { key: "ADAR_II", num: 13, he: "אדר ב׳", leapOnly: true },
  { key: "ADAR", num: 12, he: "אדר", nonLeapOnly: true },
  { key: "NISAN", num: 1, he: "ניסן" },
  { key: "IYYAR", num: 2, he: "אייר" },
  { key: "SIVAN", num: 3, he: "סיון" },
  { key: "TAMUZ", num: 4, he: "תמוז" },
  { key: "AV", num: 5, he: "אב" },
  { key: "ELUL", num: 6, he: "אלול" },
];

function hebrewYearStr(y: number): string {
  try {
    return gematriya(y);
  } catch {
    return String(y);
  }
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hdateToGregorian(day: number, monthNum: number, year: number): string {
  try {
    const monthKey = Object.entries(months).find(
      ([, v]) => v === monthNum
    )?.[0];
    if (!monthKey) return "";
    const hd = new HDate(day, monthKey, year);
    const g = hd.greg();
    return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function hdateToDisplay(day: number, monthNum: number, year: number): string {
  try {
    const monthKey = Object.entries(months).find(
      ([, v]) => v === monthNum
    )?.[0];
    if (!monthKey) return "";
    const hd = new HDate(day, monthKey, year);
    return hd.renderGematriya();
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
  maxToday,
}: HebrewDatePickerProps) {
  const t = useTranslations("create");

  // Hebrew date state as individual components
  const currentHDate = new HDate();
  const [hYear, setHYear] = useState(currentHDate.getFullYear());
  const [hMonth, setHMonth] = useState(currentHDate.getMonth());
  const [hDay, setHDay] = useState(0); // 0 = not selected

  const isLeap = useMemo(() => HDate.isLeapYear(hYear), [hYear]);

  const availableMonths = useMemo(
    () =>
      MONTH_ORDER.filter((m) => {
        if (m.leapOnly && !isLeap) return false;
        if (m.nonLeapOnly && isLeap) return false;
        return true;
      }),
    [isLeap]
  );

  const daysInMonth = useMemo(() => {
    try {
      return HDate.daysInMonth(hMonth, hYear);
    } catch {
      return 30;
    }
  }, [hMonth, hYear]);

  // Generate year options (current year back 120 years)
  const yearOptions = useMemo(() => {
    const current = new HDate().getFullYear();
    const opts = [];
    for (let y = current; y >= current - 120; y--) {
      opts.push({ value: y, label: hebrewYearStr(y) });
    }
    return opts;
  }, []);

  // Generate day options
  const dayOptions = useMemo(() => {
    const opts = [];
    for (let d = 1; d <= daysInMonth; d++) {
      opts.push({ value: d, label: gematriya(d) });
    }
    return opts;
  }, [daysInMonth]);

  // When Hebrew dropdowns change, sync Gregorian
  function syncFromHebrew(day: number, month: number, year: number) {
    if (day < 1) return;
    const greg = hdateToGregorian(day, month, year);
    if (greg) onGregorianChange(greg);
    const display = hdateToDisplay(day, month, year);
    if (display) onHebrewChange(display);
  }

  // When Gregorian input changes, sync Hebrew dropdowns
  function handleGregorianChange(val: string) {
    onGregorianChange(val);
    if (!val) return;
    try {
      const [y, m, d] = val.split("-").map(Number);
      const hd = new HDate(new Date(y, m - 1, d));
      setHYear(hd.getFullYear());
      setHMonth(hd.getMonth());
      setHDay(hd.getDate());
      onHebrewChange(hd.renderGematriya());
    } catch {
      // ignore parse errors
    }
  }

  function handleYearChange(val: string) {
    const y = Number(val);
    setHYear(y);
    // Clamp day if month has fewer days in new year
    const maxDays = HDate.daysInMonth(hMonth, y);
    const clampedDay = hDay > maxDays ? maxDays : hDay;
    if (clampedDay !== hDay) setHDay(clampedDay);
    syncFromHebrew(clampedDay || hDay, hMonth, y);
  }

  function handleMonthChange(val: string) {
    const m = Number(val);
    setHMonth(m);
    const maxDays = HDate.daysInMonth(m, hYear);
    const clampedDay = hDay > maxDays ? maxDays : hDay;
    if (clampedDay !== hDay) setHDay(clampedDay);
    syncFromHebrew(clampedDay || hDay, m, hYear);
  }

  function handleDayChange(val: string) {
    const d = Number(val);
    setHDay(d);
    syncFromHebrew(d, hMonth, hYear);
  }

  function handleToday() {
    const now = new HDate();
    setHYear(now.getFullYear());
    setHMonth(now.getMonth());
    setHDay(now.getDate());
    onGregorianChange(todayISO());
    onHebrewChange(now.renderGematriya());
  }

  // Initialize from gregorianValue prop on mount
  useEffect(() => {
    if (gregorianValue) {
      try {
        const [y, m, d] = gregorianValue.split("-").map(Number);
        const hd = new HDate(new Date(y, m - 1, d));
        setHYear(hd.getFullYear());
        setHMonth(hd.getMonth());
        setHDay(hd.getDate());
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-navy block">
        {label} {required && <span className="text-gold">*</span>}
      </label>

      {/* Hebrew date dropdowns */}
      <div>
        <label className="text-xs text-muted mb-1.5 block" dir="rtl">
          {t("hebrewLabel")}
        </label>
        <div className="grid grid-cols-3 gap-2" dir="rtl">
          {/* Day */}
          <Select value={hDay > 0 ? String(hDay) : ""} onValueChange={handleDayChange}>
            <SelectTrigger className="text-sm" dir="rtl">
              <SelectValue placeholder={t("dayPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {dayOptions.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  <span dir="rtl">{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month */}
          <Select value={String(hMonth)} onValueChange={handleMonthChange}>
            <SelectTrigger className="text-sm" dir="rtl">
              <SelectValue placeholder={t("monthPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map((m) => (
                <SelectItem key={m.key} value={String(m.num)}>
                  <span dir="rtl">{m.he}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year */}
          <Select value={String(hYear)} onValueChange={handleYearChange}>
            <SelectTrigger className="text-sm" dir="rtl">
              <SelectValue placeholder={t("yearPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  <span dir="rtl">{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Gregorian input */}
      <div>
        <label className="text-xs text-muted mb-1.5 block">
          {t("gregorianLabel")}
        </label>
        <Input
          type="date"
          value={gregorianValue}
          onChange={(e) => handleGregorianChange(e.target.value)}
          max={maxToday ? todayISO() : undefined}
        />
      </div>

      {/* Preview + Today button */}
      <div className="flex items-center justify-between">
        {hebrewValue && (
          <p className="text-xs text-muted" dir="rtl">
            {hebrewValue}
            {gregorianValue && <span className="mx-1.5">·</span>}
            {gregorianValue}
          </p>
        )}
        <button
          type="button"
          onClick={handleToday}
          className="text-xs text-gold hover:text-gold-deep font-medium transition-colors ms-auto"
        >
          {t("todayButton")}
        </button>
      </div>
    </div>
  );
}
