"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

const STEPS = [
  { key: "create", number: "01" },
  { key: "share", number: "02" },
  { key: "claim", number: "03" },
  { key: "learn", number: "04" },
];

export function HowItWorksSection() {
  const t = useTranslations("landing");

  return (
    <section className="py-20 sm:py-28 bg-cream">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-navy mb-4">
            {t("howItWorksTitle")}
          </h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            {t("howItWorksSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-navy text-gold font-heading text-xl font-bold mb-5">
                {step.number}
              </div>
              <h3 className="font-heading text-lg font-semibold text-navy mb-2">
                {t(`step_${step.key}_title`)}
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                {t(`step_${step.key}_desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
