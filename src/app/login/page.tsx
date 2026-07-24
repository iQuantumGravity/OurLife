"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setStatus("Backend not connected yet — add your Supabase keys to .env.local.");
      return;
    }
    setBusy(true);
    setStatus(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (error) return setStatus(error.message);
      setStatus("Check your email to confirm your account, then sign in.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setStatus(error.message);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted mb-3">
            OurLife
          </div>
          <h1 className="font-display text-3xl font-semibold leading-tight">
            {mode === "signin" ? "Welcome back." : "Create your login."}
          </h1>
          <p className="text-muted mt-2 text-sm">
            The living plan for the two of you — pay stubs, statements, and the
            map of where it's all going.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-6 rounded-card border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-fg">
            Backend not connected yet. Add your Supabase URL &amp; anon key to
            <code className="font-mono text-xs"> .env.local</code> to enable
            logins.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-card border border-line bg-raised px-3 py-2 text-fg outline-none focus:border-teal"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Password
            </span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-card border border-line bg-raised px-3 py-2 text-fg outline-none focus:border-teal"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-card bg-teal px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "One moment…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {status && <p className="mt-4 text-sm text-clay">{status}</p>}

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 font-mono text-xs uppercase tracking-wider text-muted hover:text-teal"
        >
          {mode === "signin"
            ? "→ Need an account? Create one"
            : "→ Already have a login? Sign in"}
        </button>
      </div>
    </main>
  );
}
