// True when the Supabase backend has been wired up via environment variables.
// Pages use this to show a friendly "connect the backend" state instead of
// crashing when the app is first cloned.
export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// True when Plaid credentials are set, enabling bank-account connections.
export const isPlaidConfigured =
  !!process.env.PLAID_CLIENT_ID && !!process.env.PLAID_SECRET;

/**
 * True when the service-role key is present. Anything touching `plaid_items`
 * needs it, because that table has RLS with no client-facing policies. Callers
 * must check this rather than constructing the admin client blindly — an
 * undefined key throws inside supabase-js and takes the whole page down with a
 * 500, which is how a missing env var turned into three broken pages.
 */
export const isServiceRoleConfigured = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
