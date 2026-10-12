import { notFound } from 'next/navigation';
import { DemoEditor } from '@/components/demo-workspace';
import { demoPlaceList } from '@/lib/demo-workspace';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getWorkspaceCopy(isLocale(locale) ? locale : 'en').edit };
}
export default async function DemoEdit({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !demoPlaceList.includes(id)) notFound();
  return <DemoEditor locale={locale} id={id} />;
}
