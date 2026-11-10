# API key check that re-hashes on every request

A minimal API over plain `node:http`. Every authenticated request checks the API key with a real
`argon2.verify` call, the same as checking a password. At the library defaults that costs hundreds
of milliseconds of CPU, so on a small shared-CPU machine, a client that polls a few times a second
can out-spend the machine's CPU baseline by itself - no database involved.

Set `KEY_CACHE_MS` to a number of milliseconds to remember a key that already passed argon2,
keyed by a fast hash of the raw key, not the raw key itself. A cache hit still re-reads the stored
record and compares its hash, so a revoked key is rejected on the very next request.

    docker build -t slow-api-demo .
    docker run --rm --cpus 0.25 slow-api-demo

## Try it without the cache (the slow path)

```bash
node server.js &
curl -s http://localhost:3000/health
curl -s -H 'x-api-key: demo-api-key-5f3a9c2e7b1d4680' http://localhost:3000/items
```

## Try it with the cache

```bash
KEY_CACHE_MS=300000 node server.js &
node scripts/load.mjs 10
curl -s -X POST http://localhost:3000/revoke
curl -s -H 'x-api-key: demo-api-key-5f3a9c2e7b1d4680' http://localhost:3000/items
```
