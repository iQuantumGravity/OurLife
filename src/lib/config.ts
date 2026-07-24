// True when the Supabase backend has been wired up via environment variables.
// Pages use this to show a friendly "connect the backend" state instead of
// crashing when the app is first cloned.
export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
