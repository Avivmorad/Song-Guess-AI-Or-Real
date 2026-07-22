export interface PublicConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  siteUrl: string;
}

export function getPublicConfig(): PublicConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabasePublishableKey) return null;
  return {
    supabaseUrl,
    supabasePublishableKey,
    siteUrl:
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000",
  };
}

export function isBackendConfigured(): boolean {
  return getPublicConfig() !== null;
}
