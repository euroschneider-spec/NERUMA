import { notFound } from 'next/navigation';
import { DraftPreview } from '@/components/draft-preview';
import { isLocale } from '@/lib/i18n';
import { getWorkspaceCopy } from '@/lib/workspace';
import { loadPlace, workspaceConfigured, workspaceSession } from '@/lib/workspace-server';

export const dynamic='force-dynamic';
// The browser tab speaks the page's language too.
export async function generateMetadata({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;const t=getWorkspaceCopy(isLocale(locale) ? locale : 'en');
  return {title:t.draft,robots:{index:false,follow:false}};
}
export default async function WorkspacePreview({params}:{params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params;if(!isLocale(locale)) notFound();
  const context=await workspaceSession(locale);if(!workspaceConfigured()) notFound();
  const result=await loadPlace(context.supabase,id,context.organisations,locale);if(!result) notFound();
  return <DraftPreview locale={locale} draft={result.draft} missingTranslation={result.missingTranslation} editHref={`/${locale}/workspace/${id}`}/>;
}
