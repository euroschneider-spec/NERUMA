'use client';

import Link from 'next/link';
import { getAuthFeedback } from '@/lib/auth-feedback';
import { useActionState, useState } from 'react';
import { authenticate, onboardOrganisation } from '@/app/auth/actions';
import type { Locale } from '@/lib/i18n';
import { getOrganisationCopy, organisationTypes } from '@/lib/organisation-copy';
import { MandateUpload } from './mandate-upload';
import { ChoiceGroup } from './choice-group';
import { getEvidenceCopy, type MandateDocument } from '@/lib/mandate-evidence';
import { getVerificationCopy } from '@/lib/verification';
import { CheckField, Field, useFormWarnings } from './form-field';
import { ResponsibilityNotice } from './responsibility-notice';

export function OrganisationForm({ locale, mode, enabled, initial, initialDocuments=[] }: {
  initialDocuments?:MandateDocument[];
  locale: Locale; mode: 'register' | 'login' | 'onboard'; enabled: boolean;
  initial?: { organisation: string; type: string; representative: string; website?:string; country?:string; registry?:string; representativeRole?:string; authorization?:string; revision?:number };
}) {
  const t = getOrganisationCopy(locale);
  const v = getVerificationCopy(locale);
  const action = mode === 'onboard' ? onboardOrganisation.bind(null, locale) : authenticate.bind(null, locale, mode);
  const [state, submit, pending] = useActionState(action, { message: '' });
  const w = useFormWarnings(locale, submit);
  const e=getEvidenceCopy(locale);const feedback=getAuthFeedback(locale);
  const [documents,setDocuments]=useState(initialDocuments);const [uploading,setUploading]=useState(false);
  const hasOrganisation = mode !== 'login';
  const needsDocument = mode === 'onboard' && !documents.length;
  const button = mode === 'onboard' ? v.submit : mode === 'register' ? v.request : t.login;

  if(mode==='register' && state.confirmation) return <section className="auth-feedback" role="status" aria-labelledby="email-confirmation-heading"><h2 id="email-confirmation-heading">{feedback.email}</h2><p>{state.message}</p><p>{feedback.notSubmitted}</p><Link className="button" href={`/${locale}/login`}>{t.login}</Link></section>;
  return <form action={submit} {...w.form} className="organisation-form" aria-label={button}>
    {state.message && <div className="auth-feedback" role="alert">{state.message}</div>}
    {pending && <p role="status">{feedback.working}</p>}
    {hasOrganisation && <><p className="notice">{v.gate}</p><input type="hidden" name="revision" value={initial?.revision || ''}/></>}
    <fieldset disabled={!enabled || pending}>
      <legend>{button}</legend>
      <div className="form-grid">
        {hasOrganisation && <>
          <Field w={w} name="organisation" label={t.organisation} className="wide"><input name="organisation" autoComplete="organization" required maxLength={160} defaultValue={initial?.organisation}/></Field>
          <ChoiceGroup className="wide" label={t.type} name="type" defaultValue={initial?.type || 'institution'} options={organisationTypes.map((type,i) => ({ value: type, label: t.types[i] }))} />
          <Field w={w} name="representative" label={t.representative}><input name="representative" autoComplete="name" required maxLength={160} defaultValue={initial?.representative}/></Field>
          <Field w={w} name="representativeRole" label={v.role}><input name="representativeRole" required minLength={2} maxLength={160} autoComplete="organization-title" defaultValue={initial?.representativeRole}/></Field>
          <Field w={w} name="website" label={v.website} className="third"><input type="url" name="website" required maxLength={500} pattern="https://.*" defaultValue={initial?.website}/></Field>
          <Field w={w} name="country" label={v.country} className="third"><input name="country" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" autoCapitalize="characters" defaultValue={initial?.country}/></Field>
          <Field w={w} name="registry" label={v.registry} className="third"><input name="registry" maxLength={300} defaultValue={initial?.registry}/></Field>
          <Field w={w} name="authorization" label={v.authorization} hint={v.hint} className="wide"><textarea name="authorization" required minLength={20} maxLength={2000} rows={3} defaultValue={initial?.authorization}/></Field>
        </>}
        {mode === 'onboard' && <MandateUpload locale={locale} documents={documents} onChange={setDocuments} onBusy={setUploading}/>}
        {mode === 'register' && <section className="wide"><h3>{e.title}</h3><p>{e.hint}</p><p>{e.afterEmail}</p></section>}
        {mode !== 'onboard' && <>
          <Field w={w} name="email" label={t.email}><input type="email" name="email" autoComplete="email" required maxLength={254}/></Field>
          <Field w={w} name="password" label={t.password} hint={mode === 'register' ? t.passwordHint : undefined}><input type="password" name="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 12 : 1} maxLength={128}/></Field>
        </>}
      </div>
      {hasOrganisation && <>
        <ResponsibilityNotice locale={locale} id="responsibility"/>
        <CheckField w={w} name="authority" label={t.authority}/>
        <CheckField w={w} name="responsibility" label={t.accept}/>
      </>}
      {needsDocument && <p id="submit-reason" className="submit-reason">{e.needed}</p>}
      <button className="button" type="submit" disabled={uploading || needsDocument} aria-describedby={needsDocument ? 'submit-reason' : undefined}>{button}</button>
    </fieldset>

  </form>;
}
