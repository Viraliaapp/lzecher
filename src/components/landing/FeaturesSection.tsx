"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  BookOpen,
  Globe,
  Users,
  Bell,
  Share2,
  Shield,
} from "lucide-react";

const FEATURES = [
  { icon: BookOpen, key: "multiTrack" },
  { icon: Globe, key: "multiLanguage" },
  { icon: Users, key: "communal" },
  { icon: Bell, key: "notifications" },
  { icon: Share2, key: "shareLinks" },
  { icon: Shield, key: "moderated" },
];

export function FeaturesSection() {
  const t = useTranslations("landing");

  return (
    <section className="py-20 sm:py-28 bg-cream">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-navy mb-4">
            {t("featuresTitle")}
          </h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            {t("featuresSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="relative group"
            >
              <div className="rounded-2xl border border-navy/5 bg-white p-8 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 mb-5">
                  <feature.icon className="h-6 w-6 text-gold-deep" />
                </div>
                <h3 className="font-heading text-lg font-semibold text-navy mb-2">
                  {t(`feature_${feature.key}_title`)}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {t(`feature_${feature.key}_desc`)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
