import { generateSeoTopicMetadata, TopicLandingPage } from "@/components/seo/TopicLandingPage";

const SLUG = "chalukat-tehillim" as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return generateSeoTopicMetadata(locale, SLUG);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <TopicLandingPage locale={locale} slug={SLUG} />;
}
