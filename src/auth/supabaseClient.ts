// The browser client. Only the public URL and the anon/publishable key live here
// (both are public by design; Row Level Security is what protects the data).
// The service_role key must never appear in this project.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/** null when the build has no Supabase settings: the game then runs offline on this device. */
export function createSupabase(
  url: string | undefined = import.meta.env.VITE_SUPABASE_URL,
  anonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY,
): SupabaseClient | null {
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}
