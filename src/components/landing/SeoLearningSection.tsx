import { getHomeSeoCopy } from "@/lib/seo-content";

interface SeoLearningSectionProps {
  locale: string;
}

export function SeoLearningSection({ locale }: SeoLearningSectionProps) {
  const copy = getHomeSeoCopy(locale);

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <p className="mb-3 font-serif text-sm italic text-gold-deep">
              {copy.eyebrow}
            </p>
            <h2 className="font-heading text-2xl font-bold leading-tight text-navy sm:text-3xl">
              {copy.title}
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
              {copy.intro}
            </p>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {copy.points.map((point) => (
                <div key={point.title} className="border-t border-gold/25 pt-4">
                  <h3 className="font-heading text-lg font-bold text-navy">
                    {point.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    {point.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-navy/10 bg-cream/60 p-5 shadow-sm sm:p-6">
            <h3 className="font-heading text-xl font-bold text-navy">
              {copy.faqTitle}
            </h3>
            <div className="mt-5 space-y-5">
              {copy.faqs.map((faq) => (
                <div key={faq.question}>
                  <h4 className="font-heading text-base font-bold text-navy">
                    {faq.question}
                  </h4>
                  <p className="mt-1 text-sm leading-7 text-muted">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
