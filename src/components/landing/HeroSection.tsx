"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { BookOpen, Users, Heart } from "lucide-react";

export function HeroSection() {
  const t = useTranslations("landing");

  return (
    <section className="relative overflow-hidden bg-navy">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(201,169,97,0.3) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Hebrew subtitle */}
            <p className="font-heading text-gold text-lg sm:text-xl mb-4 tracking-wide">
              {t("heroSubtitle")}
            </p>

            {/* Main heading */}
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-cream leading-tight mb-6">
              {t("heroTitle")}
            </h1>

            {/* Description */}
            <p className="text-cream/70 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-serif italic">
              {t("heroDescription")}
            </p>
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/create">
              <Button size="xl" className="w-full sm:w-auto">
                {t("createMemorial")}
              </Button>
            </Link>
            <Link href="/about">
              <Button
                variant="outline"
                size="xl"
                className="w-full sm:w-auto border-cream/20 text-cream hover:bg-cream/10"
              >
                {t("learnMore")}
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto"
          >
            {[
              { icon: BookOpen, label: t("statTracks"), value: "4" },
              { icon: Users, label: t("statGlobal"), value: t("statGlobalValue") },
              { icon: Heart, label: t("statLanguages"), value: "4" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <stat.icon className="h-5 w-5 text-gold mx-auto mb-2" />
                <p className="text-2xl font-heading font-bold text-cream">{stat.value}</p>
                <p className="text-xs text-cream/50">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-cream to-transparent" />
    </section>
  );
}
