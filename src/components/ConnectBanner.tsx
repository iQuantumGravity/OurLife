export function ConnectBanner() {
  return (
    <div className="mb-8 rounded-card border border-clay/50 bg-clay/10 px-5 py-4 text-sm">
      <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-clay">
        Sample data
      </div>
      <p className="text-fg">
        You&apos;re viewing a template. Connect a Supabase project (add your keys
        to <code className="font-mono text-xs">.env.local</code>), sign in, and
        your household&apos;s real plan — pay stubs, statements, and all — loads
        in place of this.
      </p>
    </div>
  );
}
