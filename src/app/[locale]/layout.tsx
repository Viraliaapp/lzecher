import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  Frank_Ruhl_Libre,
  Cormorant_Garamond,
  Inter,
} from "next/font/google";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";
import type { Metadata, Viewport } from "next";
import "../globals.css";

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-frank-ruhl",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Lzecher - Memorial Learning Platform",
    template: "%s | Lzecher",
  },
  description:
    "Honor departed loved ones through communal Torah learning. Organize Mishnayos, Tehillim, Shnayim Mikra, and Mitzvot l'iluy nishmas.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Lzecher",
    title: "Lzecher - Memorial Learning Platform",
    description:
      "Honor departed loved ones through communal Torah learning.",
    url: "https://lzecher.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lzecher - Memorial Learning Platform",
    description:
      "Honor departed loved ones through communal Torah learning.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1B2D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

interface Props {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages();
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${frankRuhl.variable} ${cormorant.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-cream text-navy font-sans">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            {children}
            <Toaster
              position="bottom-center"
              toastOptions={{
                style: {
                  background: "#0F1B2D",
                  color: "#FAF6EC",
                  border: "1px solid rgba(201, 169, 97, 0.2)",
                },
              }}
            />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
