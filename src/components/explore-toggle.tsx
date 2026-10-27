import { getExploreListingCopy } from '@/lib/explore-listing';
import { fill } from '@/lib/publishing';
import type { Locale } from '@/lib/i18n';
import { setOrganisationExplore } from '@/app/admin/explore-actions';
import { ConfirmForm } from './confirm-form';

/** A platform administrator's switch for Explore, beside Visit on the account page (brief 2026-10-27). Switching on is one click; switching off asks first. */
export function ExploreToggle({ locale, organisation, account, name, enabled }: { locale: Locale; organisation: string; account: string; name: string; enabled: boolean }) {
  const t = getExploreListingCopy(locale);
  const action = setOrganisationExplore.bind(null, locale);
  return (
    <div className="explore-toggle">
      <p><strong>{t.adminLabel}</strong> · {enabled ? t.adminOn : t.adminOff}</p>
      {enabled ? (
        <ConfirmForm action={action} fields={{ organisation, account, enabled: 'false' }} label={t.switchOff} title={fill(t.offTitle, { name })}
          body={t.offBody} confirm={t.offConfirm} cancel={t.offCancel} />
      ) : (
        <form action={action}>
          <input type="hidden" name="organisation" value={organisation} />
          <input type="hidden" name="account" value={account} />
          <input type="hidden" name="enabled" value="true" />
          <button className="button button-outline button-small" type="submit" aria-label={fill(t.switchOnAria, { name })}>{t.switchOn}</button>
        </form>
      )}
    </div>
  );
}
