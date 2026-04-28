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
          <Link href="/" className="flex items-center gap-2.5 group">
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
                "font-heading text-xl font-bold tracking-tight",
                isLanding ? "text-cream" : "text-navy"
              )}
            >
              Lzecher
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/about"
              className={cn(
                "text-sm font-medium transition-colors hover:text-gold",
                isLanding ? "text-cream/80" : "text-muted"
              )}
            >
              {t("about")}
            </Link>
            <LanguageSwitcher isLanding={isLanding} />
            {!loading && (
              <>
                {user ? (
                  <Link href="/dashboard">
                    <Button variant={isLanding ? "default" : "secondary"} size="sm">
                      {t("dashboard")}
                    </Button>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">
                    <Link href="/login">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={isLanding ? "text-cream/80 hover:text-cream hover:bg-white/10" : ""}
                      >
                        {t("login")}
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button variant="default" size="sm">
                        {t("getStarted")}
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className={cn("h-6 w-6", isLanding ? "text-cream" : "text-navy")} />
            ) : (
              <Menu className={cn("h-6 w-6", isLanding ? "text-cream" : "text-navy")} />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-3">
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
            <LanguageSwitcher isLanding={isLanding} />
            {!loading && (
              <>
                {user ? (
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    <Button variant="default" size="sm" className="w-full">
                      {t("dashboard")}
                    </Button>
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">
                        {t("login")}
                      </Button>
                    </Link>
                    <Link href="/signup" onClick={() => setMobileOpen(false)}>
                      <Button variant="default" size="sm" className="w-full">
                        {t("getStarted")}
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
