import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { authConfigured } from './config';

export async function createClient() {
  if (!authConfigured()) throw new Error('NERUMA authentication is not configured');
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    // Backup codes for two-factor sign-in are Supabase's own, still marked experimental in this version. The project
    // may not have them switched on; the app then hides them (getBackupCodes answers 'off').
    { auth: { experimental: { recoveryCodes: true } }, cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Read-only Server Components rely on proxy.ts for token refresh. */ }
      },
    } },
  );
}

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// The one definition of "signed in" for server code: a server-validated, email-confirmed,
// non-anonymous user. Returns null otherwise, so callers fail closed.
export async function confirmedUser(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user || !user.email_confirmed_at || user.is_anonymous ? null : user;
}
