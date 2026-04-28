"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { BookOpen, Music, ScrollText, Heart } from "lucide-react";

const TRACKS = [
  {
    key: "mishnayos",
    icon: BookOpen,
    color: "bg-moed/10 text-moed",
    accent: "border-moed/20",
  },
  {
    key: "tehillim",
    icon: Music,
    color: "bg-kodashim/10 text-kodashim",
    accent: "border-kodashim/20",
  },
  {
    key: "shnayimMikra",
    icon: ScrollText,
    color: "bg-zeraim/10 text-zeraim",
    accent: "border-zeraim/20",
  },
  {
    key: "mitzvot",
    icon: Heart,
    color: "bg-nashim/10 text-nashim",
    accent: "border-nashim/20",
  },
];

export function TracksSection() {
  const t = useTranslations("landing");

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-navy mb-4">
            {t("tracksTitle")}
          </h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            {t("tracksSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TRACKS.map((track, i) => (
            <motion.div
              key={track.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              className={`rounded-2xl border ${track.accent} p-6 text-center hover:shadow-lg transition-all duration-300`}
            >
              <div
                className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${track.color} mb-4`}
              >
                <track.icon className="h-7 w-7" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-navy mb-2">
                {t(`track_${track.key}_title`)}
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                {t(`track_${track.key}_desc`)}
              </p>
              <p className="mt-3 text-xs font-medium text-gold-deep">
                {t(`track_${track.key}_count`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
