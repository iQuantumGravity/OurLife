import "server-only";

/**
 * Plaid's SDK is built on axios, so a rejected call surfaces as the useless
 * "Request failed with status code 400". The part you actually need --
 * error_code, error_message, display_message -- is on `err.response.data`.
 * Throwing that away is why a misconfigured key looked like a mystery.
 */
export interface PlaidErrorInfo {
  message: string;
  errorCode: string | null;
  errorType: string | null;
  status: number;
  hint: string | null;
}

/** Actionable guidance for the mistakes that actually happen in practice. */
function hintFor(code: string | null): string | null {
  switch (code) {
    case "INVALID_API_KEYS":
    case "INVALID_CREDENTIALS":
      return "PLAID_CLIENT_ID or PLAID_SECRET is wrong for this environment. The secret is DIFFERENT per environment — a Sandbox secret will not work when PLAID_ENV=production, and vice versa.";
    case "INVALID_FIELD":
    case "INVALID_BODY":
      return "Plaid rejected the request shape. If you changed PLAID_ENV, confirm it is exactly 'sandbox', 'development' or 'production'.";
    case "INVALID_PRODUCT":
    case "PRODUCTS_NOT_SUPPORTED":
      return "Your Plaid account may not have the Transactions product enabled. Check dashboard.plaid.com → Team Settings → Products.";
    case "ITEM_LOGIN_REQUIRED":
      return "The bank connection expired and needs re-linking.";
    case "RATE_LIMIT_EXCEEDED":
      return "Too many requests to Plaid — wait a moment and try again.";
    default:
      return null;
  }
}

export function describePlaidError(err: unknown): PlaidErrorInfo {
  const anyErr = err as any;
  const data = anyErr?.response?.data;
  const status = anyErr?.response?.status ?? 500;

  if (data && (data.error_code || data.error_message)) {
    const code = data.error_code ?? null;
    return {
      // Prefer Plaid's human-facing text when it gave us one.
      message:
        data.display_message ||
        data.error_message ||
        `Plaid rejected the request (${code ?? status}).`,
      errorCode: code,
      errorType: data.error_type ?? null,
      status,
      hint: hintFor(code),
    };
  }

  return {
    message:
      anyErr instanceof Error && anyErr.message
        ? anyErr.message
        : "Could not reach Plaid.",
    errorCode: null,
    errorType: null,
    status,
    hint: null,
  };
}
