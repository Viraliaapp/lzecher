import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/*/admin", "/dashboard", "/*/dashboard", "/settings", "/*/settings", "/api/"],
      },
    ],
    sitemap: "https://lzecher.com/sitemap.xml",
  };
}
