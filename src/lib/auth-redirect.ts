/** Return a local, locale-neutral destination for next-intl's router. */
export function safeAuthRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  try {
    const url = new URL(value, "https://lzecher.invalid");
    if (url.origin !== "https://lzecher.invalid") return "/dashboard";
    let path = url.pathname;
    for (let i = 0; i < 3; i++) {
      path = decodeURIComponent(path);
      if (path.replace(/^\/(en|he|es|fr)(?=\/|$)/, "").startsWith("//") || /[\\\u0000-\u0020]/.test(path)) return "/dashboard";
    }
    const pathname = url.pathname.replace(/^\/(en|he|es|fr)(?=\/|$)/, "") || "/";
    // Avoid returning to the login flow with stale one-use credentials.
    if (/^\/(login|signup)(\/|$)/.test(pathname)) return "/dashboard";
    return pathname + url.search + url.hash;
  } catch { return "/dashboard"; }
}
