import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/about",
  "/privacy",
  "/terms",
  "/halachic-guidance",
  "/contact",
];

const PROTECTED_PREFIXES = ["/dashboard", "/create", "/admin", "/settings"];

function stripLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
    if (pathname === `/${locale}`) return "/";
  }
  return pathname;
}

function isPublic(stripped: string): boolean {
  if (PUBLIC_PATHS.includes(stripped)) return true;
  // Memorial pages are public: /memorial/[slug]
  if (stripped.startsWith("/memorial/")) return true;
  return false;
}

function isProtected(stripped: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => stripped === p || stripped.startsWith(p + "/")
  );
}

function extractLocale(pathname: string): string | null {
  for (const locale of routing.locales) {
    if (
      pathname.startsWith(`/${locale}/`) ||
      pathname === `/${locale}`
    ) {
      return locale;
    }
  }
  return null;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const stripped = stripLocale(pathname);

  if (isPublic(stripped)) {
    return intlMiddleware(request);
  }

  if (isProtected(stripped)) {
    const authed = request.cookies.get("__session")?.value === "1";
    if (!authed) {
      const locale = extractLocale(pathname) || "en";
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/(en|he|es|fr)/:path*"],
};
