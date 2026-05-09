#!/bin/bash
# Run DB migration + end-to-end signup/login/dashboard smoke test against prod.
# Usage: bash scripts/migrate-and-test.sh

BASE="https://axiyon-nine.vercel.app"
SECRET="$(cat /tmp/migsecret.txt 2>/dev/null)"
EMAIL="smoke+$RANDOM@axion-test.io"
PASSWORD="LongTestPassword123!"
NAME="Smoke Test"
ORG="Smoke Org"

echo "==== 1. v1 ROUTES SMOKE ===="
for p in "api/v1/agents" "api/v1/integrations" "api/v1/audit" "api/v1/approvals" "api/v1/workflows" "api/v1/memory" "api/v1/auth/session" "api/v1/auth/csrf"; do
  curl -sS -o /dev/null -w "  /$p %{http_code} %{time_total}s\n" --max-time 10 "$BASE/$p" 2>&1 | grep -v "Operation timed"
done

echo ""
echo "==== 2. DB MIGRATION ===="
if [ -z "$SECRET" ]; then
  echo "  no /tmp/migsecret.txt — skipping migration"
else
  curl -sS -X POST -H "Authorization: Bearer $SECRET" -w "\n  HTTP %{http_code} %{time_total}s\n" --max-time 30 "$BASE/api/admin/migrate" | head -c 1500
fi

echo ""
echo "==== 3. SIGNUP ===="
SIGNUP=$(curl -sS -X POST "$BASE/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"name\":\"$NAME\",\"password\":\"$PASSWORD\",\"orgName\":\"$ORG\"}" \
  -w "\nHTTP_CODE:%{http_code}\n" --max-time 15)
echo "$SIGNUP"

echo ""
echo "==== 4. CSRF ===="
CSRF=$(curl -sS -c /tmp/cookies.txt -X GET "$BASE/api/v1/auth/csrf" --max-time 10)
echo "$CSRF"
TOKEN=$(echo "$CSRF" | python -c "import json,sys;print(json.load(sys.stdin).get('csrfToken','?'))" 2>/dev/null || echo "?")
echo "csrfToken: $TOKEN"

echo ""
echo "==== 5. LOGIN (credentials) ===="
curl -sS -b /tmp/cookies.txt -c /tmp/cookies.txt -X POST "$BASE/api/v1/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=$EMAIL&password=$PASSWORD&csrfToken=$TOKEN&callbackUrl=$BASE/dashboard" \
  -w "\nHTTP %{http_code} %{time_total}s — final_url:%{url_effective}\n" --max-time 15

echo ""
echo "==== 6. SESSION ===="
curl -sS -b /tmp/cookies.txt "$BASE/api/v1/auth/session" -w "\nHTTP %{http_code} %{time_total}s\n" --max-time 10

echo ""
echo "==== 7. PROTECTED /dashboard ===="
curl -sS -b /tmp/cookies.txt -o /dev/null -w "/dashboard %{http_code} %{time_total}s\n" --max-time 15 "$BASE/dashboard"

echo "==== DONE ===="
