import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { YahrzeitCandle } from "@/components/brand/YahrzeitCandle";
import { Link } from "@/i18n/navigation";
import {
  getSeoTopicPage,
  getSeoTopicStructuredData,
  seoTopicAlternates,
  seoTopicLocale,
  SEO_TOPIC_SLUGS,
  type SeoTopicSlug,
} from "@/lib/seo-topic-pages";

const BASE_URL = "https://lzecher.com";

export async function generateSeoTopicMetadata(locale: string, slug: SeoTopicSlug): Promise<Metadata> {
  const normalizedLocale = seoTopicLocale(locale);
  const page = getSeoTopicPage(normalizedLocale, slug);
  const path = `/${slug}`;

  return {
    title: { absolute: page.metaTitle },
    description: page.description,
    keywords: page.keywords,
    alternates: {
      canonical: `${BASE_URL}/${normalizedLocale}${path}`,
      languages: seoTopicAlternates(slug),
    },
    openGraph: {
      title: page.metaTitle,
      description: page.description,
      url: `${BASE_URL}/${normalizedLocale}${path}`,
      type: "website",
      locale: normalizedLocale === "he" ? "he_IL" : normalizedLocale,
      siteName: "Lzecher",
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.description,
    },
  };
}

export function TopicLandingPage({ locale, slug }: { locale: string; slug: SeoTopicSlug }) {
  if (!SEO_TOPIC_SLUGS.includes(slug)) notFound();

  const normalizedLocale = seoTopicLocale(locale);
  const page = getSeoTopicPage(normalizedLocale, slug);
  const jsonLd = getSeoTopicStructuredData(normalizedLocale, slug);
  const isHebrew = normalizedLocale === "he";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main className="bg-cream text-navy">
        <section className="relative overflow-hidden bg-navy px-4 py-12 text-center text-cream sm:px-6 sm:py-16" dir={isHebrew ? "rtl" : "ltr"}>
          <div className="absolute inset-0 opacity-[0.04]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, rgba(201,169,97,0.6) 1px, transparent 0)",
                backgroundSize: "38px 38px",
              }}
            />
          </div>
          <div className="relative mx-auto max-w-4xl">
            <div className="mb-4 flex justify-center">
              <YahrzeitCandle size="sm" />
            </div>
            <p className="font-serif text-sm italic tracking-wide text-gold">{page.eyebrow}</p>
            <h1 className="mt-3 font-heading text-3xl font-black leading-tight sm:text-5xl">{page.title}</h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-cream/75 sm:text-lg">{page.description}</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/create">
                <Button size="lg">{page.primaryCta}</Button>
              </Link>
              <Link
                href="/"
                className="rounded-lg border border-cream/25 px-5 py-2.5 text-sm font-semibold text-cream transition hover:border-gold/60 hover:text-gold"
              >
                {page.secondaryCta}
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-6 sm:py-14" dir={isHebrew ? "rtl" : "ltr"}>
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_360px]">
            <article className="space-y-8">
              <div className="rounded-2xl border border-gold/20 bg-white p-6 shadow-sm sm:p-8">
                <p className="text-lg leading-9 text-navy/78">{page.intro}</p>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                {page.sections.map((section) => (
                  <section key={section.title} className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
                    <h2 className="font-heading text-xl font-bold text-navy">{section.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-muted">{section.body}</p>
                  </section>
                ))}
              </div>

              <section className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="font-heading text-2xl font-black">{page.faqTitle}</h2>
                <div className="mt-5 divide-y divide-navy/10">
                  {page.faqs.map((faq) => (
                    <div key={faq.question} className="py-5 first:pt-0 last:pb-0">
                      <h3 className="font-heading text-lg font-bold text-navy">{faq.question}</h3>
                      <p className="mt-2 text-sm leading-7 text-muted">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </section>
            </article>

            <aside className="h-fit rounded-2xl border border-gold/25 bg-[#fbf7ec] p-6 shadow-sm">
              <h2 className="font-heading text-2xl font-black">{page.stepsTitle}</h2>
              <ol className="mt-5 space-y-4">
                {page.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-sm font-bold text-navy">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 text-sm leading-7 text-navy/75">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-6 border-t border-gold/20 pt-5">
                <Link href="/create">
                  <Button className="w-full">{page.primaryCta}</Button>
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
