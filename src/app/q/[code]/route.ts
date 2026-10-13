import { NextResponse } from 'next/server';
import { exampleLocales, isExampleQrCode, requestedLocale } from '@/lib/qr';
import { chooseLocale } from '@/lib/publishing';
import { resolveQrCode } from '@/lib/published-server';

const redirect = (url: URL, path: string) => NextResponse.redirect(new URL(path, url.origin), {
  status: 307,
  headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', Vary: 'Accept-Language' },
});

/**
 * A printed QR code. One code per location, never a language: the guide opens in the visitor's phone language when it is
 * published, otherwise in a published one. A guide that is down shows a notice, not a bare 404 (DECISIONS.md, "QR codes").
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(request.url);
  const asked = requestedLocale(url);
  const phone = request.headers.get('accept-language');
  if (isExampleQrCode(code)) return redirect(url, `/${chooseLocale(exampleLocales, asked, phone)}/places/willow-museum/guide`);
  const target = await resolveQrCode(code);
  if (!target) return new Response('Unknown guide code', { status: 404 });
  if (target.status === 'unavailable') return redirect(url, `/${chooseLocale(exampleLocales, asked, phone)}/guide-unavailable`);
  return redirect(url, `/${chooseLocale(target.locales, asked, phone)}/places/${target.slug}/guide`);
}
