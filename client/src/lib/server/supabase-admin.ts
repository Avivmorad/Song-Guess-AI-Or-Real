import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface ServerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  jamendoClientId: string | null;
}

let adminClient: SupabaseClient | null = null;

export function getServerConfig(): ServerConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SERVER_BACKEND_NOT_CONFIGURED");
  }
  return {
    supabaseUrl,
    serviceRoleKey,
    jamendoClientId: process.env.JAMENDO_CLIENT_ID?.trim() || null,
  };
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const config = getServerConfig();
  adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}

export async function authenticateRequest(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("AUTH_REQUIRED");
  const { data, error } = await getSupabaseAdminClient().auth.getUser(token);
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return data.user;
}
