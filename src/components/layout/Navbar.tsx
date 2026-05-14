"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Menu, X, BookOpen, LogIn, LogOut, LayoutDashboard, Shield } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/firebase/auth";

function NavLink({
  href,
  isLanding,
  isActive,
  children,
  onClick,
  className,
}: {
  href: string;
  isLanding: boolean;
  isActive: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href as "/memorials"}
      className={cn(
        "text-sm font-medium transition-colors hover:text-gold relative",
        isLanding ? "text-cream/80" : "text-muted",
        isActive && "text-gold",
        className
      )}
      onClick={onClick}
    >
      {children}
      {isActive && (
        <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gold rounded-full" />
      )}
    </Link>
  );
}

export function Navbar() {
  const t = useTranslations("common");
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isLanding = pathname === "/";
  const isAdmin = profile?.isAdmin;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdown(false);
      }
    }
    if (profileDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileDropdown]);

  const navLinks = [
    { href: "/", label: t("memorials") },
    { href: "/about", label: t("about") },
    { href: "/halachic-guidance", label: t("halachicGuidance") },
  ];

  const userInitial = (profile?.displayName || user?.email || "?")[0].toUpperCase();

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

          {/* Right side */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Language switcher — always visible */}
            <LanguageSwitcher isLanding={isLanding} />

            {/* Desktop nav items */}
            <div className="hidden md:flex items-center gap-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  isLanding={isLanding}
                  isActive={pathname === link.href}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>

            {/* Auth button — ALWAYS visible (not behind hamburger) */}
            {!loading && (
              <>
                {user ? (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setProfileDropdown(!profileDropdown)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-white font-heading font-bold text-sm hover:bg-gold-deep transition-colors"
                      aria-label={t("profile")}
                    >
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        userInitial
                      )}
                    </button>
                    {profileDropdown && (
                      <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-lg border border-navy/10 py-2 z-50">
                        <div className="px-4 py-2 border-b border-navy/5">
                          <p className="text-sm font-medium text-navy truncate">
                            {profile?.displayName || user.email}
                          </p>
                        </div>
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted hover:bg-cream hover:text-navy transition-colors"
                          onClick={() => setProfileDropdown(false)}
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          {t("dashboard")}
                        </Link>
                        {isAdmin && (
                          <Link
                            href="/admin"
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-muted hover:bg-cream hover:text-navy transition-colors"
                            onClick={() => setProfileDropdown(false)}
                          >
                            <Shield className="h-4 w-4" />
                            {t("admin")}
                          </Link>
                        )}
                        <button
                          onClick={async () => {
                            setProfileDropdown(false);
                            await logout();
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-muted hover:bg-cream hover:text-navy transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          {t("logout")}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link href="/login">
                    <Button
                      variant={isLanding ? "outline" : "default"}
                      size="sm"
                      className={cn(
                        isLanding && "border-cream/30 text-cream hover:bg-cream/10"
                      )}
                    >
                      <LogIn className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("signIn")}</span>
                    </Button>
                  </Link>
                )}
              </>
            )}

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
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href as "/memorials"}
                className={cn(
                  "block py-2 text-sm font-medium",
                  isLanding ? "text-cream/80" : "text-muted",
                  pathname === link.href && "text-gold"
                )}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <>
                <Link
                  href="/dashboard"
                  className={cn(
                    "block py-2 text-sm font-medium",
                    isLanding ? "text-cream/80" : "text-muted"
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {t("dashboard")}
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={cn(
                      "block py-2 text-sm font-medium",
                      isLanding ? "text-cream/80" : "text-muted"
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    {t("admin")}
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
