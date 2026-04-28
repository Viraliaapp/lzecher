"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function CTASection() {
  const t = useTranslations("landing");

  return (
    <section className="relative py-20 sm:py-28 bg-navy overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(201,169,97,0.4) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-cream mb-6">
            {t("ctaTitle")}
          </h2>
          <p className="text-cream/70 text-lg max-w-2xl mx-auto mb-10 font-serif italic">
            {t("ctaDescription")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/create">
              <Button size="xl" className="w-full sm:w-auto">
                {t("ctaButton")}
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
