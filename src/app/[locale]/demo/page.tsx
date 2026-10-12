import { notFound } from 'next/navigation';
import { DemoDashboard } from '@/components/demo-workspace';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getWorkspaceCopy(isLocale(locale) ? locale : 'en').dashboard };
}
export default async function DemoHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <DemoDashboard locale={locale} />;
}
