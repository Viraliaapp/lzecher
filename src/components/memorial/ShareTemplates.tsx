"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SHARE_TEMPLATES, fillTemplate, type TemplateKey } from "@/lib/share-templates";
import { cn } from "@/lib/utils";

interface Props {
  honoree: string;
  url: string;
}

const LOCALE_LABELS: Record<string, string> = {
  he: "עברית",
  en: "English",
  es: "Español",
  fr: "Français",
};

export function ShareTemplates({ honoree, url }: Props) {
  const locale = useLocale() as "he" | "en" | "es" | "fr";
  const [activeKey, setActiveKey] = useState<TemplateKey>("shiva");
  const [displayLocale, setDisplayLocale] = useState<"he" | "en" | "es" | "fr">(locale);
  const [customText, setCustomText] = useState("");
  const [copied, setCopied] = useState(false);

  const activeTemplate = SHARE_TEMPLATES.find(t => t.key === activeKey);
  const isCustom = activeKey === ("custom" as TemplateKey);
  const rawText = isCustom ? customText : (activeTemplate?.text[displayLocale] || "");
  const filledText = isCustom ? `${customText}\n\n${url}` : fillTemplate(rawText, honoree, url);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(filledText);
      setCopied(true);
      toast.success(displayLocale === "he" ? "הועתק!" : "Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  }

  const allKeys: (TemplateKey | "custom")[] = [...SHARE_TEMPLATES.map(t => t.key), "custom"];

  return (
    <div className="mt-8 border-t border-navy/10 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="h-5 w-5 text-gold-deep shrink-0" />
        <h3 className="font-heading font-semibold text-navy text-lg">
          {locale === "he" ? "שתפו עם המשפחה" : "Share with family"}
        </h3>
      </div>

      {/* Template tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {allKeys.map(key => {
          const label = key === "custom"
            ? (displayLocale === "he" ? "כתיבה אישית" : "Custom")
            : (SHARE_TEMPLATES.find(t => t.key === key)?.label[displayLocale] || key);
          return (
            <button
              key={key}
              onClick={() => setActiveKey(key as TemplateKey)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                activeKey === key
                  ? "bg-navy text-cream border-navy"
                  : "bg-transparent text-navy border-navy/20 hover:border-navy/40"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Language selector */}
      <div className="flex gap-1 mb-3">
        {(["he", "en", "es", "fr"] as const).map(loc => (
          <button
            key={loc}
            onClick={() => setDisplayLocale(loc)}
            className={cn(
              "px-2.5 py-0.5 rounded text-xs border transition-all",
              displayLocale === loc
                ? "bg-gold/20 border-gold text-navy font-medium"
                : "border-navy/10 text-muted hover:border-navy/20"
            )}
          >
            {LOCALE_LABELS[loc]}
          </button>
        ))}
      </div>

      {/* Template text */}
      <Card className="mb-3">
        <CardContent className="p-3">
          {isCustom ? (
            <>
              <Textarea
                dir={displayLocale === "he" ? "rtl" : "ltr"}
                placeholder={displayLocale === "he" ? "כתבו הודעה אישית כאן..." : "Write your personal message here..."}
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                rows={5}
                className="mb-2 text-sm"
              />
              <p className="text-xs text-muted">
                {displayLocale === "he" ? "הקישור יתווסף אוטומטית בסוף" : "The link will be appended automatically"}
              </p>
            </>
          ) : (
            <pre
              dir={displayLocale === "he" ? "rtl" : "ltr"}
              className="text-sm text-navy whitespace-pre-wrap font-sans leading-relaxed"
            >
              {filledText}
            </pre>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleCopy} className="flex-1 sm:flex-none">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied
            ? (displayLocale === "he" ? "הועתק!" : "Copied!")
            : (displayLocale === "he" ? "העתק" : "Copy")}
        </Button>
      </div>
    </div>
  );
}
