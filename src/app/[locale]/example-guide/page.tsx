import { notFound, permanentRedirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';

// The old address of the example guide; links and bookmarks keep working.
export default async function ExampleGuideMoved({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  permanentRedirect(`/${locale}/places/willow-museum/guide`);
}
