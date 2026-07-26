"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { VoiceButton, appendSpoken } from "@/components/VoiceInput";

export type ThreadSummary = {
  id: string;
  title: string | null;
  updated_at: string;
};

export type AssistantDocument = {
  id: string;
  kind: string;
  label: string | null;
  period_label: string | null;
  status: string;
  created_at: string;
};

export type AssistantMessage = {
  id: string;
  role: string;
  content: string | null;
  tool_calls: unknown;
};

export type PlanChange = {
  action: string;
  summary: string | null;
  source: string;
  created_at: string;
};

type Props = {
  ready: boolean;
  notice: string | null;
  threadId: string | null;
  threads: ThreadSummary[];
  initialMessages: AssistantMessage[];
  documents: AssistantDocument[];
  recentChanges: PlanChange[];
};

type Bubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: { tool: string; result?: unknown }[];
};

const SUGGESTIONS = [
  "Where are we against the plan right now?",
  "Read my newest statement and tell me what changed",
  "We got a raise - take-home is now $5,400 twice a month",
  "What if rent goes up $300 a month?",
  "Move the house deposit milestone out six months",
];

function toolLabel(tool: string): string {
  switch (tool) {
    case "get_plan_snapshot":
      return "read the plan";
    case "update_baseline":
      return "updated the baseline";
    case "set_milestone":
      return "set a milestone";
    case "drop_milestone":
      return "dropped a milestone";
    case "log_pay_stub":
      return "logged a pay stub";
    case "parse_document":
      return "read a document";
    case "spending_summary":
      return "summarised spending";
    case "save_scenario":
      return "saved a scenario";
    case "record_note":
      return "wrote a journal note";
    case "list_documents":
      return "listed documents";
    case "list_recent_changes":
      return "checked the journal";
    default:
      return tool.replace(/_/g, " ");
  }
}

export default function AssistantChat({
  ready,
  notice,
  threadId: initialThreadId,
  threads,
  initialMessages,
  documents,
  recentChanges,
}: Props) {
  const seeded = useMemo<Bubble[]>(
    () =>
      initialMessages
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content)
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content as string,
          actions: Array.isArray(m.tool_calls)
            ? (m.tool_calls as { tool: string }[]).map((a) => ({ tool: a.tool }))
            : undefined,
        })),
    [initialMessages]
  );

  const [bubbles, setBubbles] = useState<Bubble[]>(seeded);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<AssistantDocument[]>(documents);
  const [parsing, setParsing] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const scrollToEnd = useCallback(() => {
    window.setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy || !ready) return;

      setError(null);
      setBusy(true);
      setDraft("");
      const localId = "local-" + Date.now();
      setBubbles((prev) => [...prev, { id: localId, role: "user", content: message }]);
      scrollToEnd();

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, threadId }),
        });
        const payload = (await res.json()) as {
          reply?: string;
          threadId?: string;
          actions?: { tool: string; result?: unknown }[];
          error?: string;
        };

        if (!res.ok) {
          setError(payload.error ?? "The assistant could not answer that.");
        } else {
          if (payload.threadId) setThreadId(payload.threadId);
          setBubbles((prev) => [
            ...prev,
            {
              id: localId + "-reply",
              role: "assistant",
              content: payload.reply ?? "",
              actions: payload.actions,
            },
          ]);
          if ((payload.actions ?? []).some((a) => a.tool === "parse_document")) {
            setDocs((prev) => prev.map((doc) => ({ ...doc })));
          }
        }
      } catch {
        setError("Network trouble - the request didn't get through.");
      } finally {
        setBusy(false);
        scrollToEnd();
      }
    },
    [busy, ready, scrollToEnd, threadId]
  );

  const parse = useCallback(async (id: string) => {
    setParsing(id);
    setError(null);
    try {
      const res = await fetch("/api/documents/" + id + "/parse", { method: "POST" });
      const payload = (await res.json()) as {
        status?: string;
        lineItems?: number;
        payStubLogged?: boolean;
        detectedKind?: string;
        error?: string;
      };
      if (!res.ok || payload.status === "failed") {
        setError(payload.error ?? "Could not read that document.");
      } else {
        setDocs((prev) =>
          prev.map((doc) => (doc.id === id ? { ...doc, status: "parsed" } : doc))
        );
        const bits = [
          payload.detectedKind ? "read as " + payload.detectedKind.replace(/_/g, " ") : null,
          typeof payload.lineItems === "number" ? payload.lineItems + " line items" : null,
          payload.payStubLogged ? "pay stub logged" : null,
        ].filter(Boolean);
        setBubbles((prev) => [
          ...prev,
          {
            id: "parse-" + id + "-" + Date.now(),
            role: "assistant",
            content:
              payload.status === "already_parsed"
                ? "That one was already read into the plan."
                : "Done - " + (bits.length ? bits.join(", ") : "document read") + ".",
          },
        ]);
        scrollToEnd();
      }
    } catch {
      setError("Network trouble while reading that document.");
    } finally {
      setParsing(null);
    }
  }, [scrollToEnd]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex min-h-[28rem] flex-col rounded-card border border-line bg-raised p-4">
        <ThreadBar threads={threads} currentId={threadId} />

        {notice ? (
          <p className="mb-4 rounded-card border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-fg">
            {notice}
          </p>
        ) : null}

        <div className="flex-1 space-y-4 overflow-y-auto">
          {bubbles.length === 0 ? (
            <div className="space-y-4">
              <LifeUpdate onSend={send} disabled={!ready || busy} />
              <p className="text-sm text-muted">
                Or ask for a change, a read on where you stand, or point me at a statement you just
                uploaded. Anything I change is written into the plan journal.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    disabled={!ready || busy}
                    className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-teal hover:text-teal disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            bubbles.map((bubble) => (
              <div key={bubble.id} className={bubble.role === "user" ? "text-right" : ""}>
                <div
                  className={
                    "inline-block max-w-[46rem] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm " +
                    (bubble.role === "user"
                      ? "bg-teal text-white"
                      : "border border-line bg-sunken text-fg")
                  }
                >
                  {bubble.content}
                </div>
                {bubble.actions && bubble.actions.length > 0 ? (
                  <p className="mt-1 text-xs text-muted">
                    {bubble.actions.map((a) => toolLabel(a.tool)).join(" · ")}
                  </p>
                ) : null}
              </div>
            ))
          )}
          {busy ? <p className="text-sm text-muted">Thinking it through…</p> : null}
          {error ? (
            <p className="rounded-card border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">
              {error}
            </p>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            rows={2}
            disabled={!ready || busy}
            placeholder={ready ? "Tell me what changed, or ask what it means…" : "See the note above to get started"}
            className="min-h-[3rem] flex-1 resize-y rounded-card border border-line bg-sunken px-3 py-2 text-sm text-fg outline-none focus:border-teal disabled:opacity-60"
          />
          <div className="flex items-center gap-2">
            <VoiceButton
              disabled={!ready || busy}
              label="Dictate a message"
              onText={(t) => setDraft((d) => appendSpoken(d, t))}
            />
            <button
              type="submit"
              disabled={!ready || busy || !draft.trim()}
              className="flex-1 rounded-card bg-teal px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 sm:flex-none"
            >
              Send
            </button>
          </div>
        </form>
      </section>

      <aside className="space-y-6">
        <div className="rounded-card border border-line bg-raised p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted">Documents</h2>
          {docs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing uploaded yet. Add pay stubs or statements on the Statements page and they'll
              show up here to be read.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {docs.map((doc) => (
                <li key={doc.id} className="text-sm">
                  <p className="font-medium text-fg">{doc.label ?? doc.kind.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted">
                    {(doc.period_label ? doc.period_label + " · " : "") + doc.status}
                  </p>
                  {doc.status !== "parsed" ? (
                    <button
                      type="button"
                      onClick={() => parse(doc.id)}
                      disabled={!ready || parsing === doc.id}
                      className="mt-1 rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-teal hover:text-teal disabled:opacity-50"
                    >
                      {parsing === doc.id ? "Reading…" : "Read into the plan"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-card border border-line bg-raised p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted">Recent changes</h2>
          {recentChanges.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No changes recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {recentChanges.map((change, index) => (
                <li key={change.created_at + index}>
                  <span className="text-fg">{change.summary ?? change.action}</span>
                  <span className="block text-xs text-muted">
                    {new Date(change.created_at).toLocaleDateString()} · {change.source}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}


/** Switch between past conversations, or start a fresh one. */
function ThreadBar({
  threads,
  currentId,
}: {
  threads: ThreadSummary[];
  currentId: string | null;
}) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
      <div className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {threads.length === 0 ? (
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            New conversation
          </span>
        ) : (
          threads.map((t) => {
            const active = t.id === currentId;
            return (
              <Link
                key={t.id}
                href={`/assistant?thread=${t.id}`}
                className={
                  "max-w-[11rem] shrink-0 truncate rounded-card px-3 py-1.5 text-xs transition-colors " +
                  (active
                    ? "bg-sunken text-teal"
                    : "text-muted hover:bg-sunken hover:text-fg")
                }
                title={t.title ?? "Conversation"}
              >
                {t.title?.trim() || "Conversation"}
              </Link>
            );
          })
        )}
      </div>
      <Link
        href="/assistant?thread=new"
        className={
          "shrink-0 rounded-card border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors " +
          (currentId === null
            ? "border-teal text-teal"
            : "border-line text-muted hover:border-teal hover:text-teal")
        }
      >
        + New
      </Link>
    </div>
  );
}

/**
 * A deliberately low-friction way to say what happened — the thing you'll
 * actually do on a phone. It's the same pipeline as the chat box; the framing
 * just invites reporting rather than asking.
 */
function LifeUpdate({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    onSend(`Life update: ${v}`);
    setText("");
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-card border border-teal/30 bg-teal/5 p-4"
    >
      <label
        htmlFor="life-update"
        className="font-mono text-[11px] uppercase tracking-wider text-teal"
      >
        Any life updates?
      </label>
      <p className="mt-1 text-xs text-muted">
        A raise, a move, a big expense, a change of plan — say it plainly and
        it gets folded into the plan and the journal.
      </p>
      <textarea
        id="life-update"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        disabled={disabled}
        placeholder="e.g. I got promoted, take-home is now $6,200 a month"
        className="mt-3 w-full resize-y rounded-card border border-line bg-sunken px-3 py-2 text-sm text-fg outline-none focus:border-teal disabled:opacity-60"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <VoiceButton
          disabled={disabled}
          label="Speak your update"
          onText={(t) => setText((d) => appendSpoken(d, t))}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="rounded-card bg-teal px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Log it
        </button>
      </div>
    </form>
  );
}
