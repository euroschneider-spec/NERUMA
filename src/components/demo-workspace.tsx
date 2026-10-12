'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { DEMO_ORG, DEMO_QR_CODE, DEMO_VISITS, listDemoPlaces, loadDemoPlace, resetDemo } from '@/lib/demo-workspace';
import { clearLocalPhotos } from '@/lib/local-photos';
import { getWorkspaceCopy } from '@/lib/workspace';
import { ConfirmDialog } from './confirm-dialog';
import { DraftPreview } from './draft-preview';
import { LocationCards } from './location-cards';
import { OnlineBuilder } from './online-builder';

/**
 * What the visitor kept in this browser, read after the page has loaded (the server has nothing to show) and read
 * again when the language or the location changes. Null until then.
 */
function useBrowserValue<T>(read: () => T, key: string): T | null {
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setState({ key, value: read() }));
    return () => cancelAnimationFrame(frame);
    // `read` is rebuilt every render and only ever depends on `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? state.value : null;
}

const resetEvent = 'neruma:demo-reset';
/** Counts the demo resets, so a page that is already open reads what is kept again. */
function useResets() {
  const [resets, setResets] = useState(0);
  useEffect(() => {
    const again = () => setResets(count => count + 1);
    window.addEventListener(resetEvent, again);
    return () => window.removeEventListener(resetEvent, again);
  }, []);
  return resets;
}

function Loading({ locale }: { locale: Locale }) {
  return <main id="main-content" className="app-main"><p role="status">{getWorkspaceCopy(locale).demoLoading}</p></main>;
}

/** The calm strip above every demo page: where the changes are kept, and a way back to the original. */
export function DemoStrip({ locale }: { locale: Locale }) {
  const t = getWorkspaceCopy(locale);
  const [asking, setAsking] = useState(false);
  const router = useRouter();
  const path = usePathname();
  async function reset() {
    resetDemo();
    try {
      await clearLocalPhotos();
    } catch {
      // Photos that stay behind are never shown again: the originals have no photo of the visitor's.
    }
    // The dashboard reads what is kept when it opens. Opened already, it is told to read again; from any other page we go there.
    const home = `/${locale}/demo`;
    if (path === home) window.dispatchEvent(new Event(resetEvent));
    else router.push(home);
    setAsking(false);
  }
  return <>
    <div className="demo-strip" role="region" aria-label={t.demoStrip}>
      <p>{t.demoStrip}</p>
      <button type="button" className="button button-outline button-small" onClick={() => setAsking(true)}>{t.resetDemo}</button>
    </div>
    <ConfirmDialog open={asking} title={t.resetDemoTitle} body={t.resetDemoBody} confirm={t.resetDemo} cancel={t.cancel} onCancel={() => setAsking(false)} onConfirm={reset} />
  </>;
}

export function DemoDashboard({ locale }: { locale: Locale }) {
  const t = getWorkspaceCopy(locale);
  const resets = useResets();
  const places = useBrowserValue(() => listDemoPlaces(locale), `${locale}:${resets}`);
  if (!places) return <Loading locale={locale} />;
  return <main id="main-content" className="app-main">
    <div className="app-heading"><h1>{t.dashboard}</h1></div>
    <section aria-labelledby="locations-heading">
      <h2 id="locations-heading">{t.locationsHeading}</h2>
      <LocationCards places={places} locale={locale} base={`/${locale}/demo`} mode="demo" sample="published" qrCode={DEMO_QR_CODE} visits={DEMO_VISITS} publishHint={t.publishDemo} />
    </section>
  </main>;
}

export function DemoEditor({ locale, id }: { locale: Locale; id: string }) {
  const t = getWorkspaceCopy(locale);
  const loaded = useBrowserValue(() => loadDemoPlace(id, locale), `${locale}:${id}`);
  if (!loaded) return <Loading locale={locale} />;
  return <main id="main-content" className="app-main">
    <div className="app-heading"><h1>{loaded.draft.name || t.edit}</h1></div>
    <OnlineBuilder key={`${id}:${locale}`} mode="demo" locale={locale} org={DEMO_ORG} initial={loaded.draft} persistedZoneIds={loaded.draft.zones.map(zone => zone.id)}
      fieldsEnabled missingTranslation={loaded.missingTranslation} />
  </main>;
}

export function DemoPreview({ locale, id }: { locale: Locale; id: string }) {
  const loaded = useBrowserValue(() => loadDemoPlace(id, locale), `${locale}:${id}`);
  if (!loaded) return <Loading locale={locale} />;
  return <DraftPreview mode="demo" locale={locale} draft={loaded.draft} missingTranslation={loaded.missingTranslation} editHref={`/${locale}/demo/${id}`} />;
}
