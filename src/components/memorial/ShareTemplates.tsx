"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy, Mail, MessageCircle, Printer, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SHARE_TEMPLATES, fillShareMessage, fillTemplate, type TemplateKey } from "@/lib/share-templates";
import { cn } from "@/lib/utils";

interface Props {
  honoree: string;
  url: string;
  preferredText?: string | null;
}

const LOCALE_LABELS: Record<string, string> = {
  he: "עברית",
  en: "English",
  es: "Español",
  fr: "Français",
};

export function ShareTemplates({ honoree, url, preferredText }: Props) {
  const locale = useLocale() as "he" | "en" | "es" | "fr";
  const [activeKey, setActiveKey] = useState<TemplateKey | "project" | "custom">(preferredText ? "project" : "shiva");
  const [displayLocale, setDisplayLocale] = useState<"he" | "en" | "es" | "fr">(locale);
  const [customText, setCustomText] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const activeTemplate = SHARE_TEMPLATES.find(t => t.key === activeKey);
  const isCustom = activeKey === "custom";
  const isProjectText = activeKey === "project";
  const rawText = isCustom ? customText : (activeTemplate?.text[displayLocale] || "");
  const filledText = isProjectText
    ? fillShareMessage(preferredText, url)
    : isCustom
      ? fillShareMessage(customText, url)
      : fillTemplate(rawText, honoree, url);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(filledText)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(honoree)}&body=${encodeURIComponent(filledText)}`;

  useEffect(() => {
    let alive = true;
    async function buildQr() {
      try {
        const QRCode = await import("qrcode");
        const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 180, color: { dark: "#0F1B2D", light: "#FFFDF8" } });
        if (alive) setQrDataUrl(dataUrl);
      } catch {
        if (alive) setQrDataUrl("");
      }
    }
    void buildQr();
    return () => { alive = false; };
  }, [url]);

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

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success(displayLocale === "he" ? "הקישור הועתק!" : "Link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  }

  const allKeys: (TemplateKey | "project" | "custom")[] = [
    ...(preferredText ? (["project"] as const) : []),
    ...SHARE_TEMPLATES.map(t => t.key),
    "custom",
  ];

  return (
    <div className="mt-8 border-t border-navy/10 pt-6">
      <div className="flex items-center gap-2 mb-4">
        <Share2 className="h-5 w-5 text-gold-deep shrink-0" />
        <h3 className="font-heading font-semibold text-navy text-lg">
          {locale === "he" ? "מרכז שיתוף" : "Share Center"}
        </h3>
      </div>

      {/* Template tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {allKeys.map(key => {
          const label = key === "project"
            ? (displayLocale === "he" ? "נוסח הדף" : "Project text")
            : key === "custom"
              ? (displayLocale === "he" ? "כתיבה אישית" : "Custom")
              : (SHARE_TEMPLATES.find(t => t.key === key)?.label[displayLocale] || key);
          return (
            <button
              key={key}
              onClick={() => setActiveKey(key)}
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
          {isProjectText ? (
            <pre
              dir={displayLocale === "he" ? "rtl" : "ltr"}
              className="text-sm text-navy whitespace-pre-wrap font-sans leading-relaxed"
            >
              {filledText}
            </pre>
          ) : isCustom ? (
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

      {qrDataUrl && (
        <div className="mb-3 flex flex-col gap-3 rounded-lg border border-gold/20 bg-cream/40 p-3 sm:flex-row sm:items-center">
          <Image src={qrDataUrl} alt={displayLocale === "he" ? "קוד QR לשיתוף" : "Share QR code"} width={112} height={112} unoptimized className="h-28 w-28 rounded-md bg-white p-1" />
          <div>
            <p className="mb-1 inline-flex items-center gap-1.5 text-sm font-bold text-navy">
              <QrCode className="h-4 w-4 text-gold" />
              {displayLocale === "he" ? "קוד QR להדפסה" : "Printable QR code"}
            </p>
            <p className="text-xs text-muted">
              {displayLocale === "he" ? "מתאים לשול, מודעה בבית הכנסת או הודעה משפחתית." : "Useful for a shul notice, family flyer, or printed update."}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={handleCopyLink} className="flex-1 sm:flex-none">
          {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiedLink
            ? (displayLocale === "he" ? "הועתק!" : "Copied!")
            : (displayLocale === "he" ? "קישור בלבד" : "Link only")}
        </Button>
        <Button size="sm" onClick={handleCopy} className="flex-1 sm:flex-none">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied
            ? (displayLocale === "he" ? "הועתק!" : "Copied!")
            : (displayLocale === "he" ? "העתק" : "Copy")}
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={emailUrl}>
            <Mail className="h-4 w-4" />
            {displayLocale === "he" ? "אימייל" : "Email"}
          </a>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {displayLocale === "he" ? "הדפס" : "Print"}
        </Button>
      </div>
    </div>
  );
}
