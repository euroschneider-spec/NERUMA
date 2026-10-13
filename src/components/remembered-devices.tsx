import { forgetRememberedDevices } from '@/app/auth/two-factor-actions';
import type { Locale } from '@/lib/i18n';
import { getTwoFactorCopy, type RememberedDevice } from '@/lib/two-factor';

const day = (value: string, locale: Locale) =>
  new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });

/** The devices that skip the code, by date only, each with Forget; forgetting asks nothing, as the cost is one more code. */
export function RememberedDevices({ locale, devices }: { locale: Locale; devices: RememberedDevice[] }) {
  const t = getTwoFactorCopy(locale);
  const forget = forgetRememberedDevices.bind(null, locale);
  return (
    <div className="remembered-devices">
      <h3>{t.devicesTitle}</h3>
      {devices.length ? (
        <>
          <ul>
            {devices.map((device) => {
              const line = t.deviceLine.replace('{from}', day(device.createdAt, locale)).replace('{until}', day(device.expiresAt, locale));
              return (
                <li key={device.id}>
                  <span>{line}{device.current && <> ({t.thisDevice})</>}</span>{' '}
                  <form action={forget} className="inline-form">
                    <input type="hidden" name="device" value={device.id} />
                    <button className="text-button" type="submit" aria-label={`${t.forget}: ${line}`}>{t.forget}</button>
                  </form>
                </li>
              );
            })}
          </ul>
          {devices.length > 1 && (
            <form action={forget}>
              <button className="button button-outline" type="submit">{t.forgetAll}</button>
            </form>
          )}
        </>
      ) : (
        <p>{t.devicesNone}</p>
      )}
    </div>
  );
}
