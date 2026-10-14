import 'server-only';
import type { Locale } from './i18n';
import type { SupabaseClient } from './supabase/server';
import { exportReadme } from './account-deletion';
import { zip, type ZipEntry } from './zip';

type ExportFile = { bucket: string; key: string; name: string };
const isFile = (value: unknown): value is ExportFile =>
  !!value && typeof value === 'object' && ['bucket', 'key', 'name'].every((key) => typeof (value as Record<string, unknown>)[key] === 'string');

/**
 * Everything held about one person, as a ZIP: a letter in their language, all the data as JSON, and their files. With `user`, an
 * administrator's export of someone else; without, the caller's own. Files are read with the caller's own rights. Returns null
 * if anything is missing: an incomplete export is never handed over as if it were complete.
 */
export async function buildExport(supabase: SupabaseClient, locale: Locale, options: { user?: string; deletion?: { requestedAt: string; deleteAfter: string } } = {}) {
  const data = options.user ? await supabase.rpc('export_user_data', { p_user: options.user }) : await supabase.rpc('export_my_data');
  const files = await supabase.rpc('export_files', options.user ? { p_user: options.user } : {});
  if (data.error || files.error || !data.data || !Array.isArray(files.data) || !files.data.every(isFile)) return null;
  const recorded = (data.data as { deletion?: { requested_at?: string; delete_after?: string } | null }).deletion;
  const deletion = options.deletion ?? (recorded?.requested_at && recorded.delete_after ? { requestedAt: recorded.requested_at, deleteAfter: recorded.delete_after } : null);
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    { name: 'README.txt', data: encoder.encode(exportReadme(locale, deletion)) },
    { name: 'data.json', data: encoder.encode(JSON.stringify(data.data, null, 2)) },
  ];
  for (const file of files.data as ExportFile[]) {
    const { data: blob, error } = await supabase.storage.from(file.bucket).download(file.key);
    if (error || !blob) return null;
    entries.push({ name: file.name, data: new Uint8Array(await blob.arrayBuffer()) });
  }
  return zip(entries);
}
