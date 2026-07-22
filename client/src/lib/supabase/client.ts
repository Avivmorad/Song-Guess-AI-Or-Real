import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicConfig } from "./config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const config = getPublicConfig();
  if (!config) throw new Error("BACKEND_NOT_CONFIGURED");
  browserClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "song-guess-session",
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return browserClient;
}

export async function ensureAnonymousSession(): Promise<void> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session) return;
  const signIn = await client.auth.signInAnonymously();
  if (signIn.error) throw signIn.error;
}
