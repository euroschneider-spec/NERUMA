import { getOrganisationCopy } from '@/lib/organisation-copy';
import type { Locale } from '@/lib/i18n';

/**
 * The responsibility text. Organisations read it in full once, as the consent step of their request
 * (`organisation-form`), and again in short when they publish; other pages link to the form's `id`.
 */
export function ResponsibilityNotice({ locale, compact = false, id }: { locale: Locale; compact?: boolean; id?: string }) {
  const t = getOrganisationCopy(locale);
  return <section className="responsibility-notice" id={id}>
    <h2>{t.responsibilityTitle}</h2>
    <p>{t.responsibilityBody}</p>
    <p>{t.responsibilityScope}</p>
    {!compact && <ul>{t.commitments.map(item => <li key={item}>{item}</li>)}</ul>}
  </section>;
}
