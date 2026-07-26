import "server-only";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const RAW_ENV = (process.env.PLAID_ENV ?? "sandbox").trim().toLowerCase();

/**
 * An unrecognised PLAID_ENV used to index straight into PlaidEnvironments and
 * yield `undefined`, so requests went nowhere with an opaque failure. Fall back
 * to sandbox and say so loudly instead.
 */
function resolveBasePath(): string {
  const known = PlaidEnvironments as Record<string, string>;
  if (known[RAW_ENV]) return known[RAW_ENV];
  console.error(
    `[plaid] PLAID_ENV="${process.env.PLAID_ENV}" is not one of ${Object.keys(known).join(", ")} — falling back to sandbox. Bank links will fail if your secret is for a different environment.`,
  );
  return known.sandbox;
}

/** Which environment we actually ended up on — surfaced by the setup guide. */
export const plaidEnv = (PlaidEnvironments as Record<string, string>)[RAW_ENV]
  ? RAW_ENV
  : "sandbox";
export const plaidEnvIsValid = Boolean(
  (PlaidEnvironments as Record<string, string>)[RAW_ENV],
);

export const plaidClient = new PlaidApi(
  new Configuration({
    basePath: resolveBasePath(),
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": (process.env.PLAID_CLIENT_ID ?? "").trim(),
        "PLAID-SECRET": (process.env.PLAID_SECRET ?? "").trim(),
      },
    },
  }),
);
