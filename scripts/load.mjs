#!/usr/bin/env node
// Sends N authenticated requests to /items, one after another, and prints
// how long each one took. Point it at the server with and without
// KEY_CACHE_MS set to see what the cache changes.
const KEY = "demo-api-key-5f3a9c2e7b1d4680";
const n = Number(process.argv[2] || 5);

async function timedRequest() {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/items", {
    headers: { "x-api-key": KEY },
  });
  await res.json();
  return Date.now() - start;
}

(async () => {
  const times = [];
  for (let i = 1; i <= n; i++) {
    const ms = await timedRequest();
    times.push(ms);
    console.log(`request ${i}: ${ms} ms`);
  }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  console.log(`average over ${n} requests: ${avg} ms`);
})();
