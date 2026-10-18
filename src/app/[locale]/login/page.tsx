import { ResendConfirmation } from '@/components/resend-confirmation';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCopy, isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { landingFor } from '@/lib/landing-server';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { OrganisationForm } from '@/components/organisation-form';
import { getResetCopy } from '@/lib/password-reset';
export default async function Login({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{password?:string}>}) {
  const {locale}=await params; if(!isLocale(locale)) notFound();
  const {password}=await searchParams;
  // Someone who is already signed in has nothing to type: send them where they would land after signing in.
  if(authConfigured()) {const supabase=await createClient();const user=await confirmedUser(supabase);if(user) redirect(await landingFor(supabase,user.id,locale));}
  const t=getOrganisationCopy(locale);
  return <main id="main-content" className="container"><div className="page-heading"><p className="eyebrow">NERUMA</p><h1>{t.login}</h1><p className="lead">{t.accountIntro}</p></div><div className="content-body">{password==='changed' && <p className="auth-feedback" role="status">{getResetCopy(locale).changed}</p>}<OrganisationForm locale={locale} mode="login" enabled={authConfigured()}/><p><Link href={`/${locale}/login/reset`}>{getResetCopy(locale).forgot}</Link></p><ResendConfirmation locale={locale} enabled={authConfigured()}/><div className="button-row"><Link className="button button-outline" href={`/${locale}/register`}>{t.register}</Link><Link className="quiet-link" href={`/${locale}/demo`}>{getCopy(locale).openWorkspace}</Link></div></div></main>;
}
