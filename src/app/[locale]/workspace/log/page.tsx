import { notFound } from 'next/navigation';
import { isLocale, longDate } from '@/lib/i18n';
import { fill } from '@/lib/publishing';
import { formatChangeValue, getVisitCopy, parseChangeLog } from '@/lib/platform-visit';
import { platformVisitReady } from '@/lib/verification-server';
import { workspaceConfigured, workspaceSession } from '@/lib/workspace-server';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: getVisitCopy(isLocale(locale) ? locale : 'en').logTitle, robots: { index: false, follow: false } };
}

// What a platform administrator changed in this organisation, in the organisation's own words. Owners and admins read it; the database says no to anyone else.
export default async function ChangeLog({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ org?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const v = getVisitCopy(locale);
  const context = await workspaceSession(locale);
  const { org: chosen } = await searchParams;
  const organisation = chosen ? context.organisations.find((o) => o.id === chosen) : context.organisations[0];
  if (!organisation || !workspaceConfigured() || !await platformVisitReady(context.supabase)) notFound();
  const result = await context.supabase.rpc('organisation_change_log', { org: organisation.id, p_limit: 100 });
  const entries = result.error ? null : parseChangeLog(result.data);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return (
    <main id="main-content" className="app-main">
      <div className="app-heading"><h1>{v.logTitle}</h1></div>
      <p>{v.logIntro}</p>
      {!entries && <p role="alert">{v.logUnavailable}</p>}
      {entries && !entries.length && <p className="note">{v.logEmpty}</p>}
      {entries && entries.length > 0 && (
        <ol className="change-log">
          {entries.map((entry) => (
            <li key={entry.id} className="change-entry">
              <h2>
                {v.actions[entry.action]} · {v.entities[entry.entity] ?? entry.entity}
              </h2>
              <p className="small-note">
                <time dateTime={entry.at}>{longDate(entry.at, locale)}, {time.format(new Date(entry.at))} UTC</time> · {entry.by ?? v.logBy}
                {entry.placeName && <> · {fill(v.logLocation, { name: entry.placeName })}</>}
              </p>
              {entry.action !== 'take_down' && (
                <dl className="change-lines">
                  {entry.changes.map((change) => (
                    <div key={change.field}>
                      <dt>{v.fields[change.field] ?? change.field.replace(/_/g, ' ')}</dt>
                      <dd>
                        {change.hasFrom && <><span className="small-label">{v.before}</span> {formatChangeValue(change.from, v.empty)}<br /></>}
                        <span className="small-label">{v.after}</span> {formatChangeValue(change.to, v.empty)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
