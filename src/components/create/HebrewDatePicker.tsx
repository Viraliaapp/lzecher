"use client";

import { useState, useEffect } from "react";
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
    const hd = new HDate(new Date(year, month - 1, day));
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
}: HebrewDatePickerProps) {
  const [hebrewStr, setHebrewStr] = useState(hebrewValue);

  useEffect(() => {
    if (gregorianValue) {
      const heb = gregorianToHebrew(gregorianValue);
      if (heb) {
        setHebrewStr(heb);
        onHebrewChange(heb);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gregorianValue]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-navy block">
        {label} {required && "*"}
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted mb-1 block">Gregorian</label>
          <Input
            type="date"
            value={gregorianValue}
            onChange={(e) => onGregorianChange(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted mb-1 block" dir="rtl">
            עברי
          </label>
          <Input
            dir="rtl"
            value={hebrewStr}
            readOnly
            className="bg-cream/50"
            placeholder="יום חודש שנה"
          />
        </div>
      </div>
    </div>
  );
}
