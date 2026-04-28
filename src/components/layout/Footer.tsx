"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BookOpen, Heart } from "lucide-react";

export function Footer() {
  const t = useTranslations("common");

  return (
    <footer className="bg-navy text-cream/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10">
                <BookOpen className="h-5 w-5 text-gold" />
              </div>
              <span className="font-heading text-xl font-bold text-cream tracking-tight">
                Lzecher
              </span>
            </div>
            <p className="text-sm text-cream/60 max-w-md leading-relaxed">
              {t("footerDescription")}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-heading text-sm font-semibold text-cream mb-3">
              {t("platform")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:text-gold transition-colors">
                  {t("about")}
                </Link>
              </li>
              <li>
                <Link href="/halachic-guidance" className="hover:text-gold transition-colors">
                  {t("halachicGuidance")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-gold transition-colors">
                  {t("contact")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-heading text-sm font-semibold text-cream mb-3">
              {t("legal")}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-gold transition-colors">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-gold transition-colors">
                  {t("terms")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-cream/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream/40">
            &copy; {new Date().getFullYear()} Lzecher. {t("allRightsReserved")}
          </p>
          <p className="text-xs text-cream/40 flex items-center gap-1">
            {t("madeWith")} <Heart className="h-3 w-3 text-gold" /> {t("forKlalYisrael")}
          </p>
        </div>
      </div>
    </footer>
  );
}
