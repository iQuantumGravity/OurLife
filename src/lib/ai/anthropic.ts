/**
 * Minimal Claude (Anthropic Messages API) client for OurLife.
 *
 * Deliberately dependency-free: it is a thin fetch wrapper so the app keeps a
 * small install surface. The API key is read from the server environment only
 * (ANTHROPIC_API_KEY) and never reaches the browser.
 */

const API_BASE = "https://api.anthropic.com/v1";
const API_VERSION = "2023-06-01";

/** Used only if the models list can't be reached and no ANTHROPIC_MODEL is set. */
const FALLBACK_MODEL = "claude-sonnet-4-5";

export type ContentBlock = Record<string, unknown>;

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

export type ClaudeResponse = {
  id: string;
  model: string;
  stop_reason: string | null;
  content: Array<Record<string, any>>;
};

export function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function requestHeaders(beta?: string): Record<string, string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to the deployment environment (Vercel -> Settings -> Environment Variables) or .env.local for local dev."
    );
  }
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": key,
    "anthropic-version": API_VERSION,
  };
  if (beta) headers["anthropic-beta"] = beta;
  return headers;
}

let cachedModel: string | null = null;

/**
 * Model names change over time, so: honour ANTHROPIC_MODEL if set, otherwise
 * ask the API which models this key can see and take the newest Sonnet.
 */
export async function resolveModel(): Promise<string> {
  const pinned = process.env.ANTHROPIC_MODEL;
  if (pinned) return pinned;
  if (cachedModel) return cachedModel;

  try {
    const res = await fetch(API_BASE + "/models?limit=40", {
      headers: requestHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      const ids = (json.data ?? [])
        .map((entry) => entry.id)
        .filter((id): id is string => typeof id === "string");
      const chosen =
        ids.find((id) => id.includes("sonnet")) ??
        ids.find((id) => id.includes("opus")) ??
        ids[0];
      if (chosen) {
        cachedModel = chosen;
        return chosen;
      }
    }
  } catch {
    // fall through to the pinned default below
  }

  cachedModel = FALLBACK_MODEL;
  return cachedModel;
}

export type CreateMessageArgs = {
  system?: string;
  messages: ClaudeMessage[];
  tools?: unknown[];
  toolChoice?: unknown;
  maxTokens?: number;
  temperature?: number;
  /** anthropic-beta header value, e.g. PDF support. */
  beta?: string;
  model?: string;
};

export async function createMessage(args: CreateMessageArgs): Promise<ClaudeResponse> {
  const model = args.model ?? (await resolveModel());
  const body: Record<string, unknown> = {
    model,
    max_tokens: args.maxTokens ?? 2048,
    messages: args.messages,
  };
  if (args.system) body.system = args.system;
  if (args.tools) body.tools = args.tools;
  if (args.toolChoice) body.tool_choice = args.toolChoice;
  if (typeof args.temperature === "number") body.temperature = args.temperature;

  const res = await fetch(API_BASE + "/messages", {
    method: "POST",
    headers: requestHeaders(args.beta),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error("Claude API error " + res.status + ": " + detail.slice(0, 600));
  }

  return (await res.json()) as ClaudeResponse;
}

/** Concatenate the plain-text blocks of a response. */
export function textFrom(response: ClaudeResponse): string {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => String(block.text ?? ""))
    .join("\n")
    .trim();
}

/** The tool_use blocks of a response, if any. */
export function toolUsesFrom(response: ClaudeResponse): Array<{
  id: string;
  name: string;
  input: Record<string, unknown>;
}> {
  return response.content
    .filter((block) => block.type === "tool_use")
    .map((block) => ({
      id: String(block.id),
      name: String(block.name),
      input: (block.input ?? {}) as Record<string, unknown>,
    }));
}
