import type { SupabaseClient } from "@supabase/supabase-js";
import type { HouseholdContext } from "./household";
import { parseDocument } from "./parse";

/**
 * The assistant's hands.
 *
 * Every mutation goes through here so that (a) it stays inside the signed-in
 * household's row-level security, and (b) it is written to plan_events with a
 * before/after snapshot. Nothing is ever hard-deleted: milestones are marked
 * dropped, scenarios are deactivated, documents keep their history.
 */

export const assistantTools = [
  {
    name: "get_plan_snapshot",
    description:
      "Read the current plan: baseline assumptions, milestones, recent pay stubs, uploaded documents, the active scenario and the latest changes. Call this before answering questions about where things stand.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "update_baseline",
    description:
      "Deep-merge a patch into the household baseline (income, savings, goals, home price, assumptions...). Only send the keys that change. Always include a short human summary of what changed and why.",
    input_schema: {
      type: "object",
      properties: {
        patch: { type: "object", description: "Partial baseline object to merge in." },
        summary: { type: "string", description: "One sentence describing the change." },
      },
      required: ["patch", "summary"],
    },
  },
  {
    name: "set_milestone",
    description:
      "Add or update a milestone on the plan (name is the key). Costs are in dollars, dates are YYYY-MM-DD.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        cost: { type: "number" },
        target_date: { type: "string" },
        status: { type: "string", enum: ["planned", "in_progress", "done", "dropped"] },
        notes: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "drop_milestone",
    description:
      "Mark a milestone as dropped. It stays on the record with status 'dropped' rather than being deleted.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        reason: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "log_pay_stub",
    description: "Record a real paycheck so the income trajectory reflects it.",
    input_schema: {
      type: "object",
      properties: {
        earner: { type: "string" },
        employer: { type: "string" },
        pay_date: { type: "string", description: "YYYY-MM-DD" },
        period_start: { type: "string" },
        period_end: { type: "string" },
        gross_amount: { type: "number" },
        net_amount: { type: "number" },
        taxes: { type: "number" },
        retirement_contrib: { type: "number" },
        other_deductions: { type: "number" },
        is_commission: { type: "boolean" },
        notes: { type: "string" },
      },
      required: ["earner", "pay_date"],
    },
  },
  {
    name: "list_documents",
    description: "List uploaded pay stubs / statements, newest first, with their parsing status.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["uploaded", "reviewed", "parsed"] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "parse_document",
    description:
      "Read an uploaded document with Claude and fold its numbers into the plan (transactions, balances, pay-stub fields). Use list_documents first to get the id.",
    input_schema: {
      type: "object",
      properties: { document_id: { type: "string" } },
      required: ["document_id"],
    },
  },
  {
    name: "spending_summary",
    description:
      "Aggregate parsed statement transactions by category over the last N months (default 3).",
    input_schema: {
      type: "object",
      properties: { months: { type: "number" }, limit: { type: "number" } },
    },
  },
  {
    name: "save_scenario",
    description:
      "Save a named what-if branch of the plan (e.g. 'Dream payout', 'Rent goes up $400'). Overrides is a partial baseline. Set activate to make it the working scenario.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        overrides: { type: "object" },
        activate: { type: "boolean" },
      },
      required: ["name", "overrides"],
    },
  },
  {
    name: "record_note",
    description:
      "Write a dated note into the plan journal - decisions, context, things to revisit. Use this when there is nothing numeric to change.",
    input_schema: {
      type: "object",
      properties: { summary: { type: "string" }, details: { type: "string" } },
      required: ["summary"],
    },
  },
  {
    name: "list_recent_changes",
    description: "The plan journal, newest first: what changed, when, and from where.",
    input_schema: { type: "object", properties: { limit: { type: "number" } } },
  },
];

export type ToolRunContext = {
  supabase: SupabaseClient;
  ctx: HouseholdContext;
  threadId: string | null;
};

type Json = Record<string, any>;

function isPlainObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(patch)) return patch;
  const out: Json = isPlainObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isPlainObject(value) ? deepMerge(out[key], value) : value;
  }
  return out;
}

async function readBaseline(run: ToolRunContext): Promise<Json> {
  const { data } = await run.supabase
    .from("household_baseline")
    .select("data")
    .eq("household_id", run.ctx.householdId)
    .maybeSingle();
  return isPlainObject(data?.data) ? (data!.data as Json) : {};
}

async function writeBaseline(
  run: ToolRunContext,
  before: Json,
  after: Json,
  action: string,
  summary: string
) {
  const { error } = await run.supabase
    .from("household_baseline")
    .upsert(
      { household_id: run.ctx.householdId, data: after },
      { onConflict: "household_id" }
    );
  if (error) throw new Error("Could not save the plan: " + error.message);

  await run.supabase.from("plan_events").insert({
    household_id: run.ctx.householdId,
    source: "chat",
    action,
    summary,
    before_data: before,
    after_data: after,
    thread_id: run.threadId,
    created_by: run.ctx.userId,
  });
}

function milestonesOf(baseline: Json): Json[] {
  return Array.isArray(baseline.milestones) ? (baseline.milestones as Json[]) : [];
}

function monthsAgo(months: number): string {
  const now = new Date();
  now.setMonth(now.getMonth() - months);
  return now.toISOString().slice(0, 10);
}

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  run: ToolRunContext
): Promise<unknown> {
  const { supabase, ctx } = run;

  switch (name) {
    case "get_plan_snapshot": {
      const [baseline, stubs, docs, scenarios, events, categories] = await Promise.all([
        readBaseline(run),
        supabase
          .from("pay_stubs")
          .select("earner, employer, pay_date, gross_amount, net_amount, is_commission")
          .eq("household_id", ctx.householdId)
          .order("pay_date", { ascending: false })
          .limit(12),
        supabase
          .from("documents")
          .select("id, kind, label, period_label, status, extracted_balance, created_at")
          .eq("household_id", ctx.householdId)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("scenarios")
          .select("id, name, description, is_active, overrides")
          .eq("household_id", ctx.householdId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("plan_events")
          .select("action, summary, source, created_at")
          .eq("household_id", ctx.householdId)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("document_line_items")
          .select("category, amount, direction, txn_date")
          .eq("household_id", ctx.householdId)
          .gte("txn_date", monthsAgo(3))
          .limit(2000),
      ]);

      const spend: Record<string, number> = {};
      let income = 0;
      for (const row of categories.data ?? []) {
        const amount = Number(row.amount) || 0;
        if (row.direction === "credit") {
          income += amount;
        } else {
          const key = row.category ?? "uncategorised";
          spend[key] = Math.round(((spend[key] ?? 0) + amount) * 100) / 100;
        }
      }

      return {
        baseline,
        recent_pay_stubs: stubs.data ?? [],
        documents: docs.data ?? [],
        scenarios: scenarios.data ?? [],
        recent_changes: events.data ?? [],
        last_3_months: { spend_by_category: spend, credits_total: Math.round(income * 100) / 100 },
      };
    }

    case "update_baseline": {
      const patch = input.patch;
      const summary = String(input.summary ?? "Updated the baseline");
      if (!isPlainObject(patch)) throw new Error("patch must be an object");
      const before = await readBaseline(run);
      const after = deepMerge(before, patch) as Json;
      await writeBaseline(run, before, after, "baseline.updated", summary);
      return { ok: true, baseline: after };
    }

    case "set_milestone": {
      const milestoneName = String(input.name ?? "").trim();
      if (!milestoneName) throw new Error("name is required");
      const before = await readBaseline(run);
      const list = milestonesOf(before).map((m) => ({ ...m }));
      const index = list.findIndex(
        (m) => String(m.name ?? "").toLowerCase() === milestoneName.toLowerCase()
      );
      const patch: Json = { name: milestoneName };
      if (typeof input.cost === "number") patch.cost = input.cost;
      if (typeof input.target_date === "string") patch.target_date = input.target_date;
      if (typeof input.status === "string") patch.status = input.status;
      if (typeof input.notes === "string") patch.notes = input.notes;

      if (index >= 0) {
        list[index] = { ...list[index], ...patch };
      } else {
        list.push({ status: "planned", ...patch });
      }

      const after = { ...before, milestones: list };
      await writeBaseline(
        run,
        before,
        after,
        index >= 0 ? "milestone.updated" : "milestone.added",
        (index >= 0 ? "Updated milestone: " : "Added milestone: ") + milestoneName
      );
      return { ok: true, milestone: list[index >= 0 ? index : list.length - 1] };
    }

    case "drop_milestone": {
      const milestoneName = String(input.name ?? "").trim();
      const before = await readBaseline(run);
      const list = milestonesOf(before).map((m) =>
        String(m.name ?? "").toLowerCase() === milestoneName.toLowerCase()
          ? { ...m, status: "dropped", dropped_reason: input.reason ?? null }
          : { ...m }
      );
      const after = { ...before, milestones: list };
      await writeBaseline(
        run,
        before,
        after,
        "milestone.dropped",
        "Dropped milestone: " + milestoneName
      );
      return { ok: true, milestones: list };
    }

    case "log_pay_stub": {
      const payDate = String(input.pay_date ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate)) throw new Error("pay_date must be YYYY-MM-DD");
      const row = {
        household_id: ctx.householdId,
        earner: String(input.earner ?? "Unlabelled"),
        employer: typeof input.employer === "string" ? input.employer : null,
        pay_date: payDate,
        period_start: typeof input.period_start === "string" ? input.period_start.slice(0, 10) : null,
        period_end: typeof input.period_end === "string" ? input.period_end.slice(0, 10) : null,
        gross_amount: Number(input.gross_amount ?? 0) || 0,
        net_amount: Number(input.net_amount ?? 0) || 0,
        taxes: Number(input.taxes ?? 0) || 0,
        retirement_contrib: Number(input.retirement_contrib ?? 0) || 0,
        other_deductions: Number(input.other_deductions ?? 0) || 0,
        is_commission: input.is_commission === true,
        notes: typeof input.notes === "string" ? input.notes : null,
        created_by: ctx.userId,
      };
      const { data, error } = await supabase.from("pay_stubs").insert(row).select("id").single();
      if (error) throw new Error("Could not log that pay stub: " + error.message);

      await supabase.from("plan_events").insert({
        household_id: ctx.householdId,
        source: "chat",
        action: "pay_stub.logged",
        summary: "Logged " + row.earner + " paycheck for " + payDate,
        after_data: row,
        thread_id: run.threadId,
        created_by: ctx.userId,
      });
      return { ok: true, id: data?.id, pay_stub: row };
    }

    case "list_documents": {
      let query = supabase
        .from("documents")
        .select("id, kind, label, period_label, status, extracted_balance, extracted_notes, created_at")
        .eq("household_id", ctx.householdId)
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(input.limit ?? 25) || 25, 100));
      if (typeof input.status === "string") query = query.eq("status", input.status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { documents: data ?? [] };
    }

    case "parse_document": {
      const documentId = String(input.document_id ?? "");
      if (!documentId) throw new Error("document_id is required");
      return await parseDocument(supabase, ctx, documentId);
    }

    case "spending_summary": {
      const months = Math.min(Math.max(Number(input.months ?? 3) || 3, 1), 24);
      const { data, error } = await supabase
        .from("document_line_items")
        .select("category, merchant, amount, direction, txn_date, is_recurring")
        .eq("household_id", ctx.householdId)
        .gte("txn_date", monthsAgo(months))
        .limit(5000);
      if (error) throw new Error(error.message);

      const byCategory: Record<string, { total: number; count: number }> = {};
      const byMerchant: Record<string, number> = {};
      let debits = 0;
      let credits = 0;

      for (const row of data ?? []) {
        const amount = Number(row.amount) || 0;
        if (row.direction === "credit") {
          credits += amount;
          continue;
        }
        debits += amount;
        const key = row.category ?? "uncategorised";
        const bucket = byCategory[key] ?? { total: 0, count: 0 };
        bucket.total = Math.round((bucket.total + amount) * 100) / 100;
        bucket.count += 1;
        byCategory[key] = bucket;
        if (row.merchant) {
          byMerchant[row.merchant] = Math.round(((byMerchant[row.merchant] ?? 0) + amount) * 100) / 100;
        }
      }

      const topMerchants = Object.entries(byMerchant)
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.min(Number(input.limit ?? 15) || 15, 50))
        .map(([merchant, total]) => ({ merchant, total }));

      return {
        months,
        transactions: (data ?? []).length,
        debits_total: Math.round(debits * 100) / 100,
        credits_total: Math.round(credits * 100) / 100,
        monthly_average_spend: Math.round((debits / months) * 100) / 100,
        by_category: byCategory,
        top_merchants: topMerchants,
      };
    }

    case "save_scenario": {
      const scenarioName = String(input.name ?? "").trim();
      if (!scenarioName) throw new Error("name is required");
      const overrides = isPlainObject(input.overrides) ? input.overrides : {};
      const activate = input.activate === true;

      const { data: existing } = await supabase
        .from("scenarios")
        .select("id")
        .eq("household_id", ctx.householdId)
        .eq("name", scenarioName)
        .limit(1)
        .maybeSingle();

      let scenarioId = existing?.id as string | undefined;

      if (scenarioId) {
        await supabase
          .from("scenarios")
          .update({
            description: typeof input.description === "string" ? input.description : null,
            overrides,
            is_active: activate,
          })
          .eq("id", scenarioId);
      } else {
        const { data, error } = await supabase
          .from("scenarios")
          .insert({
            household_id: ctx.householdId,
            name: scenarioName,
            description: typeof input.description === "string" ? input.description : null,
            overrides,
            is_active: activate,
            created_by: ctx.userId,
          })
          .select("id")
          .single();
        if (error) throw new Error("Could not save that scenario: " + error.message);
        scenarioId = data?.id as string;
      }

      if (activate && scenarioId) {
        await supabase
          .from("scenarios")
          .update({ is_active: false })
          .eq("household_id", ctx.householdId)
          .neq("id", scenarioId);
      }

      await supabase.from("plan_events").insert({
        household_id: ctx.householdId,
        source: "chat",
        action: existing ? "scenario.updated" : "scenario.created",
        summary: (activate ? "Activated scenario: " : "Saved scenario: ") + scenarioName,
        after_data: { name: scenarioName, overrides, is_active: activate },
        thread_id: run.threadId,
        created_by: ctx.userId,
      });

      return { ok: true, id: scenarioId, name: scenarioName, is_active: activate };
    }

    case "record_note": {
      const summary = String(input.summary ?? "").trim();
      if (!summary) throw new Error("summary is required");
      const { error } = await supabase.from("plan_events").insert({
        household_id: ctx.householdId,
        source: "chat",
        action: "note",
        summary,
        after_data: typeof input.details === "string" ? { details: input.details } : null,
        thread_id: run.threadId,
        created_by: ctx.userId,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    case "list_recent_changes": {
      const { data, error } = await supabase
        .from("plan_events")
        .select("action, summary, source, created_at")
        .eq("household_id", ctx.householdId)
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(input.limit ?? 20) || 20, 100));
      if (error) throw new Error(error.message);
      return { changes: data ?? [] };
    }

    default:
      throw new Error("Unknown tool: " + name);
  }
}
