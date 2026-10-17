import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfigured } from '@/lib/supabase/config';

export async function proxy(request: NextRequest) {
  if (!authConfigured()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    } },
  );
  await supabase.auth.getClaims();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = { matcher: [
  '/en/account/:path*', '/ro/account/:path*', '/de/account/:path*',
  '/en/workspace/:path*', '/ro/workspace/:path*', '/de/workspace/:path*',
  '/en/admin/:path*', '/ro/admin/:path*', '/de/admin/:path*',
  '/en/login', '/ro/login', '/de/login', '/en/register', '/ro/register', '/de/register',
  '/en/login/verify', '/ro/login/verify', '/de/login/verify',
] };
