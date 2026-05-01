"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Menu, X, BookOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const t = useTranslations("common");
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLanding = pathname === "/";

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-300",
        isLanding
          ? "bg-navy border-navy-soft"
          : "bg-white/95 backdrop-blur-md border-navy/5"
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 group-hover:bg-gold/20 transition-colors">
              <BookOpen
                className={cn(
                  "h-5 w-5",
                  isLanding ? "text-gold" : "text-gold-deep"
                )}
              />
            </div>
            <span
              className={cn(
                "font-heading text-xl font-bold tracking-tight hidden min-[400px]:inline",
                isLanding ? "text-cream" : "text-navy"
              )}
            >
              Lzecher
            </span>
          </Link>

          {/* Right side: Language switcher (ALWAYS visible) + Desktop nav + Mobile hamburger */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Language switcher — always visible on all screen sizes */}
            <LanguageSwitcher isLanding={isLanding} />

            {/* Desktop nav items */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/memorials"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-gold",
                  isLanding ? "text-cream/80" : "text-muted"
                )}
              >
                {t("memorials")}
              </Link>
              <Link
                href="/about"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-gold",
                  isLanding ? "text-cream/80" : "text-muted"
                )}
              >
                {t("about")}
              </Link>
              {!loading && (
                <>
                  {user ? (
                    <Link href="/dashboard">
                      <Button variant={isLanding ? "default" : "secondary"} size="sm">
                        {t("dashboard")}
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/login">
                      <Button variant="default" size="sm">
                        {t("login")}
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 -mr-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className={cn("h-5 w-5", isLanding ? "text-cream" : "text-navy")} />
              ) : (
                <Menu className={cn("h-5 w-5", isLanding ? "text-cream" : "text-navy")} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-3 border-t border-navy/10 pt-3">
            <Link
              href="/memorials"
              className={cn(
                "block py-2 text-sm font-medium",
                isLanding ? "text-cream/80" : "text-muted"
              )}
              onClick={() => setMobileOpen(false)}
            >
              {t("memorials")}
            </Link>
            <Link
              href="/about"
              className={cn(
                "block py-2 text-sm font-medium",
                isLanding ? "text-cream/80" : "text-muted"
              )}
              onClick={() => setMobileOpen(false)}
            >
              {t("about")}
            </Link>
            {!loading && (
              <>
                {user ? (
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    <Button variant="default" size="sm" className="w-full">
                      {t("dashboard")}
                    </Button>
                  </Link>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="default" size="sm" className="w-full">
                      {t("login")}
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
