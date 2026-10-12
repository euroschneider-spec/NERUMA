import { ResendConfirmation } from '@/components/resend-confirmation';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCopy, isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { authConfigured } from '@/lib/supabase/config';
import { OrganisationForm } from '@/components/organisation-form';
export default async function Login({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params; if(!isLocale(locale)) notFound();
  const t=getOrganisationCopy(locale);
  return <main id="main-content" className="container"><div className="page-heading"><p className="eyebrow">NERUMA</p><h1>{t.login}</h1><p className="lead">{t.accountIntro}</p></div><div className="content-body"><OrganisationForm locale={locale} mode="login" enabled={authConfigured()}/><ResendConfirmation locale={locale} enabled={authConfigured()}/><div className="button-row"><Link className="button button-outline" href={`/${locale}/register`}>{t.register}</Link><Link className="quiet-link" href={`/${locale}/demo`}>{getCopy(locale).openWorkspace}</Link></div></div></main>;
}
