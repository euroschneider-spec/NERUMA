'use client';
import { useActionState, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { getVerificationCopy, type OrganizationApplication } from '@/lib/verification';
import { getEvidenceCopy, type MandateDocument } from '@/lib/mandate-evidence';
import { reviewOrganization } from '@/app/admin/actions';
import { ChoiceGroup } from './choice-group';

export function OrganisationReviewForm({locale,application,self,documents}:{locale:Locale;application:Pick<OrganizationApplication,'id'|'revision'|'status'>;self:boolean;documents:MandateDocument[]}) {
  const v=getVerificationCopy(locale);const e=getEvidenceCopy(locale);
  const initialDecision=application.status==='approved' ? 'suspended' : 'approved';
  const [decision,setDecision]=useState(initialDecision);
  const [state,submit,pending]=useActionState(reviewOrganization.bind(null,locale),{message:''});
  const approving=decision==='approved';
  if(self) return <p className="notice">{v.self}</p>;
  return <form action={submit} className="organisation-form">
    <input type="hidden" name="application" value={application.id}/><input type="hidden" name="revision" value={application.revision}/>
    <fieldset disabled={pending}><legend>{v.decision}</legend><div className="form-grid">
      <ChoiceGroup className="wide" label={v.decision} name="decision" value={decision} onChange={setDecision} options={application.status==='approved' ? [{value:'suspended',label:v.suspend}] : [{value:'approved',label:v.approve},...(application.status!=='suspended' ? [{value:'needs_information',label:v.more},{value:'rejected',label:v.reject}] : [])]}/>
      <label className="form-field wide">{v.source}<input name="source" required={approving} minLength={approving?10:undefined} maxLength={1000}/></label>
      <label className="form-field wide">{v.evidence}<textarea name="evidence" required={approving} minLength={approving?20:undefined} maxLength={2000} rows={3}/></label>
      <label className="form-field wide">{v.note}<textarea name="note" required minLength={10} maxLength={2000} rows={3}/></label>
    </div>
    {approving && <><label className="checkbox-label commitment"><input type="checkbox" name="entity" required/>{v.entity}</label><label className="checkbox-label commitment"><input type="checkbox" name="mandate" required/>{v.mandate}</label></>}
    {approving && (documents.length ? documents.map(doc=><label key={doc.id} className="checkbox-label commitment"><input type="checkbox" name="reviewedDocument" value={doc.id} required/>{e.reviewed} {doc.filename}</label>) : <p role="status">{e.missing}</p>)}
    <p>{v.audit}</p><button className="button" type="submit" disabled={approving && !documents.length}>{v.save}</button></fieldset>
    {state.message && <p role="status">{state.message}</p>}
  </form>;
}
