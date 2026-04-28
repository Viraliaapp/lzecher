"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const candleStyles = `
  @keyframes flicker {
    0%, 100% { transform: scale(1) rotate(-1deg); opacity: 0.9; }
    50% { transform: scale(1.05) rotate(1deg); opacity: 1; }
  }
  @keyframes glow {
    0%, 100% { filter: drop-shadow(0 0 8px rgba(201, 169, 97, 0.4)); }
    50% { filter: drop-shadow(0 0 16px rgba(201, 169, 97, 0.7)); }
  }
`;

function CandleSvg() {
  return (
    <svg
      width="64"
      height="120"
      viewBox="0 0 64 120"
      fill="none"
      className="mx-auto"
      style={{ animation: "glow 3s ease-in-out infinite" }}
    >
      <g style={{ animation: "flicker 2s ease-in-out infinite", transformOrigin: "32px 30px" }}>
        <ellipse cx="32" cy="30" rx="10" ry="22" fill="#C9A961" opacity="0.9" />
        <ellipse cx="32" cy="28" rx="6" ry="14" fill="#E8CD93" opacity="0.8" />
        <ellipse cx="32" cy="26" rx="3" ry="8" fill="#FAF6EC" opacity="0.9" />
      </g>
      <rect x="31" y="48" width="2" height="8" rx="1" fill="#2A2D34" />
      <rect x="22" y="56" width="20" height="56" rx="3" fill="#FAF6EC" opacity="0.9" />
      <ellipse cx="26" cy="56" rx="3" ry="4" fill="#FAF6EC" opacity="0.7" />
      <rect x="18" y="108" width="28" height="8" rx="2" fill="#C9A961" opacity="0.6" />
    </svg>
  );
}

export default function LocaleNotFound() {
  const t = useTranslations("common");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: candleStyles }} />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-navy-deep via-navy to-navy-soft">
        <div className="text-center max-w-lg px-6">
          <div className="mb-8">
            <CandleSvg />
          </div>

          <p className="text-sm tracking-[0.3em] text-gold font-semibold uppercase mb-4 font-sans">
            404
          </p>

          <h1 className="font-heading text-4xl font-bold text-cream leading-tight mb-4">
            {t("pageNotFound")}
          </h1>

          <p className="text-cream/50 text-sm leading-relaxed mb-10 font-sans">
            {t("pageNotFoundDesc")}
          </p>

          <Link
            href="/"
            className="inline-block px-10 py-3.5 bg-gradient-to-br from-gold to-gold-warm text-navy font-semibold rounded-lg shadow-[0_4px_24px_rgba(201,169,97,0.3)] hover:shadow-[0_6px_32px_rgba(201,169,97,0.45)] hover:scale-[1.02] transition-all duration-200 font-sans"
          >
            {t("backHome")}
          </Link>
        </div>
      </div>
    </>
  );
}
