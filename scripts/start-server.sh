#!/bin/bash
# Start the API in the background (inherits KEY_CACHE_MS from the caller's
# shell, if set) and wait until it answers. Startup itself runs one argon2
# hash, so this can take a moment on a CPU-limited container.
node ~/app/server.js >/tmp/server.log 2>&1 &
echo $! > /tmp/server.pid
for i in $(seq 1 100); do
  if curl -s -o /dev/null http://localhost:3000/health; then
    exit 0
  fi
  sleep 0.2
done
echo "server did not start" >&2
cat /tmp/server.log >&2
exit 1
