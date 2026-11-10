#!/usr/bin/env node
// Minimal API-key-protected API. Every authenticated request runs a real
// password-style hash check (argon2) against the stored key, the same way
// an API key check that reuses a password-hashing library would.
//
// Set KEY_CACHE_MS to a positive number of milliseconds to remember a key
// that already passed argon2, keyed by a fast hash of the raw key. A cache
// hit still re-reads the stored record and compares its hash, so a revoked
// or rotated key stops working on the very next request; the raw key itself
// is never stored anywhere.
const http = require("http");
const crypto = require("crypto");
const argon2 = require("argon2");

const CACHE_MS = Number(process.env.KEY_CACHE_MS || 0);
const RAW_KEY = "demo-api-key-5f3a9c2e7b1d4680";

let keyRecord = null; // { hash, revoked } - filled in once the startup hash is ready
const verifiedCache = new Map(); // sha256(rawKey) -> { hash, expiresAt }

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body + "\n");
}

// The slow path: a real argon2.verify against the stored hash. At the
// library defaults this costs hundreds of milliseconds of CPU on a small
// shared-CPU machine.
async function verifyWithArgon2(rawKey) {
  if (!keyRecord || keyRecord.revoked) return null;
  const ok = await argon2.verify(keyRecord.hash, rawKey);
  return ok ? keyRecord : null;
}

async function verifyApiKey(rawKey) {
  const digest = crypto.createHash("sha256").update(rawKey).digest("hex");

  if (CACHE_MS > 0) {
    const cached = verifiedCache.get(digest);
    if (cached && cached.expiresAt > Date.now()) {
      if (keyRecord && !keyRecord.revoked && keyRecord.hash === cached.hash) {
        return keyRecord;
      }
      verifiedCache.delete(digest); // the record changed or was revoked
    }
  }

  const record = await verifyWithArgon2(rawKey);
  if (record && CACHE_MS > 0) {
    verifiedCache.set(digest, { hash: record.hash, expiresAt: Date.now() + CACHE_MS });
  }
  return record;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && req.url === "/revoke") {
    if (keyRecord) keyRecord.revoked = true;
    return sendJson(res, 200, { ok: true, revoked: true });
  }

  if (req.method === "GET" && req.url === "/items") {
    const rawKey = req.headers["x-api-key"] || "";
    const record = await verifyApiKey(rawKey);
    if (!record) return sendJson(res, 401, { error: "invalid or revoked api key" });
    return sendJson(res, 200, { ok: true, items: ["alpha", "beta", "gamma"] });
  }

  sendJson(res, 404, { error: "not found" });
});

// Hash the demo key at startup, like a signup would, before accepting traffic.
argon2.hash(RAW_KEY).then((hash) => {
  keyRecord = { hash, revoked: false };
  server.listen(3000, () => console.log("listening on 3000"));
});
