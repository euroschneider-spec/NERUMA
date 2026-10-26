import type { Locale } from '@/lib/i18n';
import { startVisit } from '@/app/admin/visit-actions';

/** "Visit": a platform administrator opens one organisation's workspace (brief 2026-10-26). The name is in the label, so each button is told apart by a screen reader. */
export function VisitButton({ locale, organisation, label, ariaLabel }: { locale: Locale; organisation: string; label: string; ariaLabel: string }) {
  return (
    <form action={startVisit.bind(null, locale)}>
      <input type="hidden" name="organisation" value={organisation} />
      <button className="button button-outline button-small" type="submit" aria-label={ariaLabel}>{label}</button>
    </form>
  );
}
