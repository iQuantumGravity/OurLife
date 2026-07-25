import { NextResponse } from "next/server";
import { hasClaudeKey } from "@/lib/ai/anthropic";
import { aiSupabase, currentHousehold, isSupabaseConfigured } from "@/lib/ai/household";
import { parseDocument } from "@/lib/ai/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Read one uploaded pay stub / statement and fold its numbers into the plan. */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase isn't connected yet." }, { status: 503 });
  }
  if (!hasClaudeKey()) {
    return NextResponse.json(
      { error: "Claude isn't connected yet. Add ANTHROPIC_API_KEY and redeploy." },
      { status: 503 }
    );
  }

  const supabase = aiSupabase();
  const ctx = await currentHousehold(supabase);
  if (!ctx) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const outcome = await parseDocument(supabase, ctx, params.id);
  const status = outcome.status === "failed" ? 422 : 200;
  return NextResponse.json(outcome, { status });
}
