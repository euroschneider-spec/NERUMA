import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getOrganisationCopy } from '@/lib/organisation-copy';
import { authConfigured } from '@/lib/supabase/config';
import { confirmedUser, createClient } from '@/lib/supabase/server';
import { deletionDay, fill, getDeletionCopy, longDate } from '@/lib/account-deletion';
import { accountDeletionReady } from '@/lib/verification-server';
import { getTwoFactorStatus } from '@/lib/two-factor-server';
import { twoFactorStep } from '@/lib/two-factor';
import { DeleteAccountForm } from '@/components/delete-account-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Delete my account', robots: { index: false, follow: false } };

export default async function DeleteAccount({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale) || !authConfigured()) notFound();
  const t = getDeletionCopy(locale);
  const supabase = await createClient();
  const user = await confirmedUser(supabase);
  if (!user) redirect(`/${locale}/login`);
  const twoFactor = await getTwoFactorStatus(supabase);
  if (twoFactor && twoFactorStep(twoFactor) === 'verify') redirect(`/${locale}/login/verify`);
  const ready = await accountDeletionReady(supabase);
  const date = longDate(deletionDay(), locale);
  // Which organisations go with the account: the ones this person owns alone. And whether it is locked already.
  const own = ready ? await supabase.rpc('export_my_data') : null;
  const lockedUntil = ((own?.data as { deletion?: { delete_after?: string } | null } | null)?.deletion?.delete_after) || undefined;
  const alone = ((own?.data as { organisations_you_own_alone?: { organisation: string }[] } | null)?.organisations_you_own_alone ?? []).map((org) => org.organisation);
  return (
    <main id="main-content" className="container verification-page">
      <div className="page-heading">
        <h1>{t.title}</h1>
        <p className="lead">{t.intro}</p>
      </div>
      <div className="content-body">
        {!ready || own?.error ? (
          <p className="notice" role="status">{t.unavailable}</p>
        ) : (
          <>
            {!lockedUntil && <section aria-labelledby="what-happens">
              <h2 id="what-happens">{t.whatHappens}</h2>
              <ul>
                <li>{t.now}</li>
                {alone.map((name) => <li key={name}>{fill(t.held, { name, date })}</li>)}
                <li>{fill(t.onDate, { date })}</li>
                <li>{t.reports}</li>
                <li>{fill(t.restore, { date })}</li>
              </ul>
            </section>}
            <DeleteAccountForm locale={locale} enrolled={!!twoFactor?.enrolled} date={date} lockedUntil={lockedUntil} />
          </>
        )}
        <p><Link className="quiet-link" href={`/${locale}/account`}>{getOrganisationCopy(locale).account}</Link></p>
      </div>
    </main>
  );
}
