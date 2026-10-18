'use client';
import { useActionState } from 'react';
import { resendConfirmation } from '@/app/auth/actions';
import { getAuthFeedback } from '@/lib/auth-feedback';
import type { Locale } from '@/lib/i18n';
export function ResendConfirmation({locale,enabled}:{locale:Locale;enabled:boolean}) {
 const t=getAuthFeedback(locale);const [state,submit,pending]=useActionState(resendConfirmation.bind(null,locale),{message:''});
 const question=locale==='ro'?'Nu ai primit emailul?':locale==='de'?'Keine E-Mail erhalten?':'Didn\'t get the email?';
 return <details className="notice"><summary>{question}</summary><h2>{t.resend}</h2><p>{t.resendIntro}</p><form action={submit} className="organisation-form"><fieldset disabled={!enabled || pending}><legend>{t.resend}</legend><label className="form-field">{locale==='ro'?'Emailul pentru confirmare':locale==='de'?'E-Mail für die Bestätigung':'Confirmation email address'}<input type="email" name="email" autoComplete="email" required maxLength={254}/></label><button className="button" type="submit">{t.resend}</button></fieldset>{pending && <p role="status">{t.working}</p>}{state.message && <p role={state.confirmation?'status':'alert'}>{state.message}</p>}</form></details>;
}
