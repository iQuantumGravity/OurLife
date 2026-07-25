#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# OurLife deployment smoke test
#
# Hits the Plaid link-token and assistant endpoints and reports what each
# status code means. Contains NO secrets — everything is read from the
# environment.
#
#   BASE_URL     required. e.g. https://our-life-gules.vercel.app
#   SESSION_COOKIE  optional. A real Supabase session cookie. Without it, both
#                   endpoints correctly answer 401 — which is itself a useful
#                   signal (see the table at the end).
#
# Usage:
#   BASE_URL=https://your-app.vercel.app ./scripts/smoke-test.sh
#
#   # Authenticated run (to exercise the happy path):
#   #   DevTools → Application → Cookies → copy the sb-*-auth-token pair
#   BASE_URL=https://your-app.vercel.app \
#   SESSION_COOKIE='sb-qwyrurrkmhwdcrgssrpf-auth-token=...' \
#     ./scripts/smoke-test.sh
# ---------------------------------------------------------------------------
set -uo pipefail

if [[ -z "${BASE_URL:-}" ]]; then
  echo "error: BASE_URL is not set." >&2
  echo "  BASE_URL=https://your-app.vercel.app $0" >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"
TIMEOUT="${TIMEOUT:-30}"

bold=$(tput bold 2>/dev/null || printf '')
dim=$(tput dim 2>/dev/null || printf '')
reset=$(tput sgr0 2>/dev/null || printf '')

if [[ -n "${SESSION_COOKIE:-}" ]]; then
  echo "${dim}Running WITH a session cookie (happy path reachable).${reset}"
else
  echo "${dim}Running WITHOUT a session cookie — expect 307 → /login on everything.${reset}"
  echo "${dim}That is the middleware, not a failure. Set SESSION_COOKIE to test config.${reset}"
fi
echo "${dim}Target: ${BASE_URL}${reset}"
echo

# probe <label> <method> <path> [json-body]
probe() {
  local label="$1" method="$2" path="$3" body="${4:-}"
  local url="${BASE_URL}${path}"

  echo "${bold}── ${label}${reset}"
  echo "   ${method} ${path}"

  # No -L: a 307 to /login is a meaningful result, not something to follow.
  local args=(-sS -m "$TIMEOUT" -X "$method" -o /tmp/smoke_body.$$ -w '%{http_code}')
  args+=(-H 'Content-Type: application/json')
  [[ -n "${SESSION_COOKIE:-}" ]] && args+=(-H "Cookie: ${SESSION_COOKIE}")
  [[ -n "$body" ]] && args+=(--data "$body")

  local code
  if ! code=$(curl "${args[@]}" "$url" 2>/tmp/smoke_err.$$); then
    echo "   status : ${bold}network error${reset}"
    echo "   detail : $(tr -d '\n' < /tmp/smoke_err.$$)"
    echo "   → Is BASE_URL right, and is the deployment live?"
    rm -f /tmp/smoke_body.$$ /tmp/smoke_err.$$
    echo
    return
  fi

  echo "   status : ${bold}${code}${reset}"
  printf '   body   : '
  if command -v jq >/dev/null 2>&1; then
    jq -c . < /tmp/smoke_body.$$ 2>/dev/null || head -c 300 /tmp/smoke_body.$$
  else
    head -c 300 /tmp/smoke_body.$$
  fi
  echo

  case "$code" in
    200) echo "   → ${bold}Healthy.${reset} Authenticated and fully configured." ;;
    307|302)
         if [[ -n "${SESSION_COOKIE:-}" ]]; then
           echo "   → ${bold}Cookie rejected.${reset} Expired, or from a different Supabase project."
         else
           echo "   → ${bold}Expected without a cookie.${reset} The middleware redirects to /login"
           echo "     before the route handler runs, so config is NOT verified by this result."
           echo "     Re-run with SESSION_COOKIE to actually test configuration."
         fi ;;
    401) echo "   → Handler reached, no valid session. (Rare: middleware normally redirects first.)" ;;
    503) echo "   → ${bold}Misconfigured.${reset} A required env var is missing in this deployment." ;;
    400) echo "   → Reached the handler; the request body was rejected. Config and auth are fine." ;;
    404) echo "   → ${bold}Route not found.${reset} Wrong path, or this commit isn't deployed yet." ;;
    500) echo "   → Configured, but the handler threw. Check the Vercel runtime logs." ;;
    502) echo "   → Upstream (Anthropic) rejected the call — usually a bad or unfunded API key." ;;
    *)   echo "   → Unexpected. Check the Vercel runtime logs." ;;
  esac
  rm -f /tmp/smoke_body.$$ /tmp/smoke_err.$$
  echo
}

# NOTE: the route is /api/plaid/create-link-token (not /api/plaid/link-token).
probe "Plaid — create link token" POST "/api/plaid/create-link-token"
probe "Plaid — sync transactions" POST "/api/plaid/sync"
probe "Assistant (Claude)"        POST "/api/assistant" '{"message":"smoke test: reply with OK"}'

cat <<EOF
${bold}How to read this${reset}

  ${bold}Plaid endpoints${reset} (/api/plaid/*)
    503  "Plaid not configured"  → PLAID_CLIENT_ID or PLAID_SECRET missing.
    401  "not signed in"         → configured correctly; just no session.
    500                          → keys present but Plaid rejected them. Most
                                   often a sandbox/production secret mismatch:
                                   PLAID_SECRET must match PLAID_ENV.
    200                          → link_token issued. Fully working.

  ${bold}Assistant${reset} (/api/assistant)
    503                          → ANTHROPIC_API_KEY or the Supabase vars missing.
    401                          → configured; not signed in.
    502                          → key present but Anthropic refused it
                                   (invalid key, or no credit on the account).
    200                          → replied. Fully working.

  ${bold}Any endpoint${reset}
    307 → /login                 → the middleware bounced the request before the
                                   handler ran. Everything under /api is behind
                                   auth (src/middleware.ts matches all non-static
                                   paths; only /login, /auth and /invite are public).

${bold}Important${reset}: without SESSION_COOKIE you will get 307 on every endpoint and
learn nothing about configuration — the middleware short-circuits ahead of the
handler's own 503/401 checks. ${bold}A session cookie is required to smoke-test env
vars.${reset} Grab one from DevTools → Application → Cookies → sb-*-auth-token.

Env vars live in: Vercel → your project → Settings → Environment Variables.
Changing them requires a redeploy to take effect.
EOF
