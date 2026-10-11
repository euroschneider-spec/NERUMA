'use client';
import { useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import type { getWorkspaceCopy } from '@/lib/workspace';

/** The QR code and link of one location, in the browser's own modal dialog (focus stays inside, Escape closes). */
export function QrDialog({ code, name, locale, t }: { code: string; name: string; locale: Locale; t: ReturnType<typeof getWorkspaceCopy> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const image = `/api/qr/${code}?locale=${locale}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/q/${code}?locale=${locale}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <button type="button" className="button button-outline button-small" onClick={() => { setCopied(false); ref.current?.showModal(); }}>{t.qrButton}</button>
      <dialog ref={ref} className="confirm-dialog qr-dialog" aria-labelledby={`qr-title-${code}`}>
        <h2 id={`qr-title-${code}`}>{t.qrTitle}</h2>
        <p>{t.qrBody}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- an SVG from our own route; nothing to optimise */}
        <img className="qr-image" src={image} alt={`${t.qrAlt} ${name}`} width={256} height={256} />
        <p className="qr-link"><span>{t.qrLink}</span> <code>{`/q/${code}?locale=${locale}`}</code></p>
        <div className="confirm-actions qr-actions">
          <button type="button" className="button button-outline" onClick={copy}>{t.qrCopy}</button>
          <a className="button button-outline" href={`${image}&download=1`} download>{t.qrDownload}</a>
          <button type="button" className="button" autoFocus onClick={() => ref.current?.close()}>{t.qrClose}</button>
        </div>
        <p role="status" className="qr-status">{copied ? t.qrCopied : ''}</p>
      </dialog>
    </>
  );
}
