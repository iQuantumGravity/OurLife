import { NextResponse } from "next/server";
import {
  createMessage,
  hasClaudeKey,
  textFrom,
  toolUsesFrom,
  type ClaudeMessage,
} from "@/lib/ai/anthropic";
import { aiSupabase, currentHousehold, isSupabaseConfigured } from "@/lib/ai/household";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { assistantTools, runTool } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** How many times Claude may call tools before we insist on a written answer. */
const MAX_TOOL_ROUNDS = 6;
const HISTORY_LIMIT = 30;

type ToolAction = {
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
};

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase isn't connected yet, so there is no plan to work on." },
      { status: 503 }
    );
  }

  if (!hasClaudeKey()) {
    return NextResponse.json(
      {
        error:
          "Claude isn't connected yet. Add ANTHROPIC_API_KEY to the deployment environment and redeploy.",
      },
      { status: 503 }
    );
  }

  const supabase = aiSupabase();
  const ctx = await currentHousehold(supabase);
  if (!ctx) {
    return NextResponse.json({ error: "Sign in to use the assistant." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    message?: unknown;
    threadId?: unknown;
  };

  const prompt = typeof body.message === "string" ? body.message.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Ask for something first." }, { status: 400 });
  }
  if (prompt.length > 8000) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  }

  let threadId = typeof body.threadId === "string" && body.threadId ? body.threadId : null;

  if (!threadId) {
    const { data, error } = await supabase
      .from("chat_threads")
      .insert({
        household_id: ctx.householdId,
        created_by: ctx.userId,
        title: prompt.slice(0, 70),
      })
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Could not start a conversation." }, { status: 500 });
    }
    threadId = data.id as string;
  }

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  const messages: ClaudeMessage[] = (history ?? [])
    .filter(
      (row) =>
        typeof row.content === "string" &&
        row.content.trim().length > 0 &&
        (row.role === "user" || row.role === "assistant")
    )
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content as string,
    }));

  messages.push({ role: "user", content: prompt });

  await supabase.from("chat_messages").insert({
    household_id: ctx.householdId,
    thread_id: threadId,
    role: "user",
    content: prompt,
    author_user_id: ctx.userId,
  });

  const system = await buildSystemPrompt(supabase, ctx, threadId);
  const actions: ToolAction[] = [];
  const working: ClaudeMessage[] = [...messages];
  let reply = "";
  let model = "";

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const lastRound = round === MAX_TOOL_ROUNDS - 1;
      const response = await createMessage({
        system,
        messages: working,
        tools: lastRound ? undefined : assistantTools,
        maxTokens: 2048,
      });
      model = response.model;

      const said = textFrom(response);
      if (said) reply = reply ? reply + "\n\n" + said : said;

      const toolUses = toolUsesFrom(response);
      if (toolUses.length === 0) break;

      working.push({ role: "assistant", content: response.content as Record<string, unknown>[] });

      const results: Record<string, unknown>[] = [];
      for (const use of toolUses) {
        let result: unknown;
        try {
          result = await runTool(use.name, use.input, { supabase, ctx, threadId });
        } catch (err) {
          result = { error: err instanceof Error ? err.message : "That tool failed." };
        }
        actions.push({ tool: use.name, input: use.input, result });
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify(result).slice(0, 20000),
        });
      }

      working.push({ role: "user", content: results });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "The assistant hit an error.";
    return NextResponse.json({ error: message, threadId, actions }, { status: 502 });
  }

  if (!reply) {
    reply = actions.length
      ? "Done - I've updated the plan. Ask me to walk through what changed if you'd like."
      : "I'm not sure how to help with that yet.";
  }

  await supabase.from("chat_messages").insert({
    household_id: ctx.householdId,
    thread_id: threadId,
    role: "assistant",
    content: reply,
    tool_calls: actions.length ? actions : null,
    model,
  });

  await supabase
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  return NextResponse.json({ threadId, reply, actions, model });
}
