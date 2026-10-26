import QRCode from 'qrcode';
import { isExampleQrCode, qrOrigin, requestedLocale } from '@/lib/qr';
import { resolveQrCode } from '@/lib/published-server';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isExampleQrCode(code) && !await resolveQrCode(code)) return new Response('Unknown guide code', { status: 404 });
  const url = new URL(request.url);
  const destination = new URL(`/q/${code}`, qrOrigin(url, process.env.VIANORAE_SITE_URL));
  // The printed code carries no language; only a caller that asks for one gets it.
  const asked = requestedLocale(url);
  if (asked) destination.searchParams.set('locale', asked);
  const svg = await QRCode.toString(destination.toString(), {
    type: 'svg', errorCorrectionLevel: 'M', margin: 4, width: 256, color: { dark: '#1b3025', light: '#ffffff' },
  });
  const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
  return new Response(svg, { headers: {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'Content-Disposition': `${disposition}; filename="neruma-guide-qr-${code}.svg"`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  } });
}
