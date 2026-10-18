import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { authConfigured } from './supabase/config';
import type { Locale } from './i18n';
import { parsePublishedGuide, parsePublishedPlaces, parseQrTarget, slugPattern, type PublishedGuide, type PublishedPlace, type QrTarget } from './publishing';
import { PHOTO_BUCKET } from './workspace';

/**
 * What visitors read: published guides, the Explore list and QR codes. These use the public (anonymous) key with no
 * session, and only the functions that return published data (`published_guide`, `published_places`, `resolve_qr`).
 * When the database isn't configured, or answers badly, nothing is published as far as a visitor can tell.
 */
export function publicClient() {
  if (!authConfigured()) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    // Next must not cache these answers: unpublishing takes effect on the next scan.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}

export async function getPublishedGuide(slug: string, locale: Locale): Promise<PublishedGuide | null> {
  const supabase = publicClient();
  if (!supabase || !slugPattern.test(slug)) return null;
  try {
    const { data, error } = await supabase.rpc('published_guide', { guide_address: slug, lang: locale });
    return error ? null : parsePublishedGuide(data);
  } catch {
    return null;
  }
}

export async function getPublishedPlaces(locale: Locale): Promise<PublishedPlace[]> {
  const supabase = publicClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc('published_places', { lang: locale });
    return error ? [] : parsePublishedPlaces(data);
  } catch {
    return [];
  }
}

export async function resolveQrCode(code: string): Promise<QrTarget | null> {
  const supabase = publicClient();
  if (!supabase || !slugPattern.test(code)) return null;
  try {
    const { data, error } = await supabase.rpc('resolve_qr', { code });
    return error ? null : parseQrTarget(data);
  } catch {
    return null;
  }
}

/** A photo of a currently published guide. The database policy answers only for those; anything else is not found. */
export async function readPublishedPhoto(key: string): Promise<Blob | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(key);
    return error ? null : data;
  } catch {
    return null;
  }
}
