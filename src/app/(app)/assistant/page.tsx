import AssistantChat, {
  type AssistantDocument,
  type AssistantMessage,
  type PlanChange,
  type ThreadSummary,
} from "@/components/AssistantChat";
import { hasClaudeKey } from "@/lib/ai/anthropic";
import { aiSupabase, currentHousehold, isSupabaseConfigured } from "@/lib/ai/household";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Assistant · OurLife",
};

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: { thread?: string };
}) {
  const supabaseReady = isSupabaseConfigured();
  const claudeReady = hasClaudeKey();

  let threadId: string | null = null;
  let threads: ThreadSummary[] = [];
  let messages: AssistantMessage[] = [];
  let documents: AssistantDocument[] = [];
  let recentChanges: PlanChange[] = [];
  let signedIn = false;

  if (supabaseReady) {
    const supabase = aiSupabase();
    const ctx = await currentHousehold(supabase);

    if (ctx) {
      signedIn = true;

      const { data: threadRows } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at")
        .eq("household_id", ctx.householdId)
        .order("updated_at", { ascending: false })
        .limit(50);
      threads = (threadRows ?? []) as ThreadSummary[];

      // "?thread=new" deliberately resolves to no thread, so the next message
      // starts a fresh conversation instead of appending to the last one.
      const requested = searchParams.thread;
      if (requested === "new") {
        threadId = null;
      } else if (requested && threads.some((t) => t.id === requested)) {
        threadId = requested;
      } else {
        threadId = threads[0]?.id ?? null;
      }

      if (threadId) {
        const { data: history } = await supabase
          .from("chat_messages")
          .select("id, role, content, tool_calls")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true })
          .limit(60);
        messages = (history ?? []) as AssistantMessage[];
      }

      const { data: docs } = await supabase
        .from("documents")
        .select("id, kind, label, period_label, status, created_at")
        .eq("household_id", ctx.householdId)
        .order("created_at", { ascending: false })
        .limit(20);
      documents = (docs ?? []) as AssistantDocument[];

      const { data: events } = await supabase
        .from("plan_events")
        .select("action, summary, source, created_at")
        .eq("household_id", ctx.householdId)
        .order("created_at", { ascending: false })
        .limit(10);
      recentChanges = (events ?? []) as PlanChange[];
    }
  }

  const ready = supabaseReady && claudeReady && signedIn;

  let notice: string | null = null;
  if (!supabaseReady) {
    notice =
      "Supabase isn't connected in this environment, so there's no plan to work on yet. Add the Supabase env vars and redeploy.";
  } else if (!signedIn) {
    notice = "Sign in and the assistant will work on your household's plan.";
  } else if (!claudeReady) {
    notice =
      "Claude isn't connected yet. Add ANTHROPIC_API_KEY to the deployment environment (Vercel → Settings → Environment Variables) and redeploy, and this page comes alive.";
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Assistant
        </p>
        <h1 className="font-display text-3xl">Talk to the plan.</h1>
        <p className="max-w-2xl text-sm text-muted">
          Tell it what happened, ask where you stand, run a what-if, or have an
          uploaded statement read in. Changes are made in the plan itself and
          written to a journal, so the two of you can always see how it evolved.
        </p>
      </header>

      <AssistantChat
        ready={ready}
        notice={notice}
        threadId={threadId}
        threads={threads}
        initialMessages={messages}
        documents={documents}
        recentChanges={recentChanges}
      />
    </div>
  );
}
