/**
 * Shown only when the backend genuinely isn't reachable — missing Supabase
 * env vars in this deployment. It never stands in for a signed-in user's
 * data: the app shows real figures or an honest empty state, never a sample
 * plan dressed up as yours.
 */
export function ConnectBanner() {
  return (
    <div className="mb-8 rounded-card border border-clay/50 bg-clay/10 px-5 py-4 text-sm">
      <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-clay">
        Backend not connected
      </div>
      <p className="text-fg">
        This deployment is missing its Supabase keys, so there&apos;s nothing to
        load. Add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,
        then redeploy. The{" "}
        <a href="/setup" className="text-teal hover:underline">
          setup guide
        </a>{" "}
        shows exactly what&apos;s missing.
      </p>
    </div>
  );
}
