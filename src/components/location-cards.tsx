import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { getPublishingCopy } from '@/lib/publishing';
import { getWorkspaceCopy, type AttentionKind, type PlaceSummary } from '@/lib/workspace';
import { PublishButton } from './publish-button';
import { ExploreSwitch } from './explore-switch';
import { QrDialog } from './qr-dialog';
import { StepPhoto, type WorkspaceMode } from './step-photo';

/**
 * The dashboard's location cards, for the real workspace and the demo. `base` is where editing lives
 * (`/en/workspace` or `/en/demo`). `sample` adds a QR code and visit count: to every card, only to published
 * ones, or to none (design samples; real locations get them when publishing exists, DECISIONS.md "QR codes").
 */
export function LocationCards({ places, locale, base, mode = 'live', sample = 'none', qrCode, visits, publishHint, publishing = false, exploreOrg, exploreOn = false }: {
  places: PlaceSummary[]; locale: Locale; base: string; mode?: WorkspaceMode; sample?: 'none' | 'all' | 'published';
  qrCode?: string; visits?: number; publishHint?: string; publishing?: boolean;
  /** The organisation, when a platform administrator has switched Explore on for it and the person may choose; each card then has a "Show in Explore" switch. */
  exploreOrg?: string;
  /** Whether Explore is switched on for it; if not, the switch is shown greyed out, with a hint to contact NERUMA. */
  exploreOn?: boolean;
}) {
  const t = getWorkspaceCopy(locale);
  const p = getPublishingCopy(locale);
  const attentionText = (kind: AttentionKind) => kind === 'unpublishedChanges' ? p.attentionUnpublished : t[kind === 'fewSteps' ? 'attentionFewSteps' : kind === 'missingText' ? 'attentionMissingText' : 'attentionMissingAlt'];
  return <ul className="location-cards">{places.map(place => {
    const showSample = sample === 'all' || (sample === 'published' && place.status === 'published');
    return <li key={place.id} className="location-card">
      {place.photoKey
        ? <StepPhoto mode={mode} className="location-photo" storageKey={place.photoKey} alt={`${t.cardPhotoAlt} ${place.name}`} width={600} height={338} />
        : <div className="location-photo location-photo-empty">{t.cardNoPhoto}</div>}
      <div className="location-card-head"><h3><Link href={`${base}/${place.id}`}>{place.name}</Link></h3><span className={place.status === 'published' ? 'status-badge is-published' : 'status-badge'}>{place.status === 'published' ? t.statusPublished : t.statusDraft}</span></div>
      <p className="location-address">{[place.address, place.city].filter(Boolean).join(', ') || t.addressMissing}</p>
      <div className="location-attention">
        <h4>{t.attentionHeading}</h4>
        {place.attention.length ? <ul>{place.attention.map(kind => <li key={kind}>{attentionText(kind)}</li>)}</ul> : <p>{t.attentionClear}</p>}
      </div>
      {exploreOrg && <ExploreSwitch locale={locale} org={exploreOrg} place={place.id} shown={place.showInExplore ?? true} enabled={exploreOn} />}
      {showSample && visits !== undefined && <p className="location-visits"><span>{t.visitsLabel}</span> <strong>{visits}</strong> <em>({t.visitsSample})</em></p>}
      <div className="location-card-actions">
        <Link className="button button-outline button-small" href={`${base}/${place.id}`}>{t.edit}</Link>
        {(place.qrCode ?? (showSample ? qrCode : undefined)) && <QrDialog code={(place.qrCode ?? qrCode)!} name={place.name} t={t} />}
        {publishing && place.status === 'published' && place.slug && <Link className="quiet-link" href={`/${locale}/places/${place.slug}/guide`} target="_blank" rel="noopener noreferrer">{p.viewPublic}</Link>}
        {/* With publishing live, Publish sits in the editor, where the saved version is; the card keeps the disabled one only before then. */}
        {!publishing && <PublishButton label={t.publish} hint={publishHint ?? t.publishSoon} small />}
      </div>
    </li>;
  })}</ul>;
}
