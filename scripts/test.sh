#!/bin/bash
fail() { echo "FAIL: $1"; exit 1; }
cd ~
KEY='demo-api-key-5f3a9c2e7b1d4680'
BASE=http://localhost:3000

bash scripts/start-server.sh || fail "server did not start"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/health")
[ "$CODE" = "200" ] || fail "health check should be 200, got $CODE"
echo "ok 1 - the unauthenticated health check answers right away"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/items")
[ "$CODE" = "401" ] || fail "items without a key should be 401, got $CODE"
echo "ok 2 - items without an api key is rejected"

RESULT=$(curl -s -H "x-api-key: $KEY" "$BASE/items")
echo "$RESULT" | grep -q '"ok":true' || fail "a valid key should be accepted, got $RESULT"
echo "ok 3 - a valid api key is accepted (argon2 verify runs on every request)"

curl -s -X POST "$BASE/revoke" >/dev/null
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "x-api-key: $KEY" "$BASE/items")
[ "$CODE" = "401" ] || fail "a revoked key should be 401, got $CODE"
echo "ok 4 - a revoked key is rejected on the very next request"

kill "$(cat /tmp/server.pid)" 2>/dev/null
sleep 0.3
KEY_CACHE_MS=300000 bash scripts/start-server.sh || fail "cached server did not start"

RESULT=$(curl -s -H "x-api-key: $KEY" "$BASE/items")
echo "$RESULT" | grep -q '"ok":true' || fail "cached mode should still accept a valid key, got $RESULT"
echo "ok 5 - with the cache enabled, a valid key is still accepted"

curl -s -X POST "$BASE/revoke" >/dev/null
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "x-api-key: $KEY" "$BASE/items")
[ "$CODE" = "401" ] || fail "a revoked key must be rejected even with a warm cache, got $CODE"
echo "ok 6 - revocation still applies immediately, even with a warm cache"

echo "ALL PASSED"
