import { readPublishedPhoto } from '@/lib/published-server';
import { uuidPattern } from '@/lib/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

/** A photo of a published guide, for anyone. Drafts' photos stay private: the database serves only published ones. */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key') || '';
  const parts = key.split('/');
  if (parts.length !== 4 || !parts.slice(0, 3).every((part) => uuidPattern.test(part)) || !parts[3].endsWith('.webp') || !uuidPattern.test(parts[3].slice(0, -5))) return notFound();
  const photo = await readPublishedPhoto(key);
  if (!photo) return notFound();
  return new Response(photo, { headers: {
    'Content-Type': 'image/webp',
    // Short, so a photo taken down by unpublishing disappears soon.
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  } });
}
