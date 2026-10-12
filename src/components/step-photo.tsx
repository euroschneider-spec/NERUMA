'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { demoSampleSource } from '@/lib/demo-workspace';
import { readLocalPhoto } from '@/lib/local-photos';
import { photoUrl } from '@/lib/workspace';

export type WorkspaceMode = 'live' | 'demo';

/** A photo kept in this browser (the demo), as an address the page can show. Null while it is being read, or when it is gone. */
export function useLocalPhoto(id?: string) {
  const [result, setResult] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    let url: string | undefined;
    readLocalPhoto(id).then(blob => {
      if (!active) return;
      url = blob ? URL.createObjectURL(blob) : undefined;
      setResult({ id, url: url ?? null });
    }).catch(() => { if (active) setResult({ id, url: null }); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return result?.id === id ? result : null;
}

/** The photo id inside a storage key (`organisation/place/step/photo.webp`). */
const photoIdOf = (storageKey: string) => storageKey.split('/').pop()?.replace(/\.webp$/, '') ?? '';

/**
 * One step photo. In the live workspace it comes from the private storage route; in the demo it is either one of
 * the sample illustrations or a photo the visitor added, which never left their browser.
 */
export function StepPhoto({ storageKey, mode, alt, width, height, className }: {
  storageKey: string; mode: WorkspaceMode; alt: string; width: number; height: number; className?: string;
}) {
  const id = photoIdOf(storageKey);
  const sample = mode === 'demo' ? demoSampleSource(id) : undefined;
  const local = useLocalPhoto(mode === 'demo' && !sample ? id : undefined);
  const src = mode === 'live' ? photoUrl(storageKey) : sample ?? local?.url;
  if (!src) return <span className={className} role="img" aria-label={alt} style={{ display: 'block', aspectRatio: `${width} / ${height}` }} />;
  return <Image unoptimized src={src} alt={alt} width={width} height={height} className={className} />;
}
