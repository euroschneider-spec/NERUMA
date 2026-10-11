'use client';

import Link from 'next/link';
import { getAuthFeedback } from '@/lib/auth-feedback';
import { useActionState, useState } from 'react';
import { authenticate, onboardOrganisation } from '@/app/auth/actions';
import type { Locale } from '@/lib/i18n';
import { getOrganisationCopy, organisationTypes } from '@/lib/organisation-copy';
import { MandateUpload } from './mandate-upload';
import { getEvidenceCopy, type MandateDocument } from '@/lib/mandate-evidence';
import { getVerificationCopy } from '@/lib/verification';

export function OrganisationForm({ locale, mode, enabled, initial, initialDocuments=[] }: {
  initialDocuments?:MandateDocument[];
  locale: Locale; mode: 'register' | 'login' | 'onboard'; enabled: boolean;
  initial?: { organisation: string; type: string; representative: string; website?:string; country?:string; registry?:string; representativeRole?:string; authorization?:string; revision?:number };
}) {
  const t = getOrganisationCopy(locale);
  const v = getVerificationCopy(locale);
  const action = mode === 'onboard' ? onboardOrganisation.bind(null, locale) : authenticate.bind(null, locale, mode);
  const [state, submit, pending] = useActionState(action, { message: '' });
  const e=getEvidenceCopy(locale);const feedback=getAuthFeedback(locale);
  const [documents,setDocuments]=useState(initialDocuments);const [uploading,setUploading]=useState(false);
  const hasOrganisation = mode !== 'login';
  const button = mode === 'onboard' ? v.submit : mode === 'register' ? v.request : t.login;

  if(mode==='register' && state.confirmation) return <section className="auth-feedback" role="status" aria-labelledby="email-confirmation-heading"><h2 id="email-confirmation-heading">{feedback.email}</h2><p>{state.message}</p><p>{feedback.notSubmitted}</p><Link className="button" href={`/${locale}/login`}>{t.login}</Link></section>;
  return <form action={submit} className="organisation-form" aria-label={button}>
    {state.message && <div className="auth-feedback" role="alert">{state.message}</div>}
    {pending && <p role="status">{feedback.working}</p>}
    {hasOrganisation && <><p className="notice">{v.gate}</p><input type="hidden" name="revision" value={initial?.revision || ''}/></>}
    <fieldset disabled={!enabled || pending}>
      <legend>{button}</legend>
      <div className="form-grid">
        {hasOrganisation && <>
          <label className="form-field">{t.organisation}<input name="organisation" autoComplete="organization" required maxLength={160} defaultValue={initial?.organisation}/></label>
          <div className="form-field"><label htmlFor="organisation-type">{t.type}</label><select id="organisation-type" name="type" defaultValue={initial?.type || 'institution'}>{organisationTypes.map((type,i) => <option key={type} value={type}>{t.types[i]}</option>)}</select></div>
          <label className="form-field wide">{t.representative}<input name="representative" autoComplete="name" required maxLength={160} defaultValue={initial?.representative}/></label>
          <label className="form-field">{v.website}<input type="url" name="website" required maxLength={500} pattern="https://.*" defaultValue={initial?.website}/></label>
          <label className="form-field">{v.country}<input name="country" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" autoCapitalize="characters" defaultValue={initial?.country}/></label>
          <label className="form-field">{v.registry}<input name="registry" maxLength={300} defaultValue={initial?.registry}/></label>
          <label className="form-field">{v.role}<input name="representativeRole" required minLength={2} maxLength={160} autoComplete="organization-title" defaultValue={initial?.representativeRole}/></label>
          <div className="form-field wide"><label htmlFor="organisation-authorization">{v.authorization}</label><textarea id="organisation-authorization" name="authorization" required minLength={20} maxLength={2000} rows={3} aria-describedby="authorization-hint" defaultValue={initial?.authorization}/><small id="authorization-hint">{v.hint}</small></div>
        </>}
        {mode === 'onboard' && <MandateUpload locale={locale} documents={documents} onChange={setDocuments} onBusy={setUploading}/>}
        {mode === 'register' && <section className="notice wide"><h3>{e.title}</h3><p>{e.hint}</p><p>{e.afterEmail}</p></section>}
        {mode !== 'onboard' && <>
          <label className="form-field">{t.email}<input type="email" name="email" autoComplete="email" required maxLength={254}/></label>
          <div className="form-field"><label htmlFor="account-password">{t.password}</label><input id="account-password" type="password" name="password" aria-describedby={mode === 'register' ? 'password-hint' : undefined} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 12 : 1} maxLength={128}/>{mode === 'register' && <small id="password-hint">{t.passwordHint}</small>}</div>
        </>}
      </div>
      {hasOrganisation && <>
        <label className="checkbox-label commitment"><input type="checkbox" name="authority" required/>{t.authority}</label>
        <label className="checkbox-label commitment"><input type="checkbox" name="responsibility" required/>{t.accept}</label>
      </>}
      <button className="button" type="submit" disabled={uploading || (mode==='onboard' && !documents.length)}>{button}</button>
    </fieldset>

  </form>;
}
