# Shared Uniswap price feed

A Cloudflare Worker collects the USDC/USDT v3 0.01% pool every 15 minutes using
Cloudflare Cron Triggers. One SQLite-backed Durable Object owns the cursor and
48-hour history for every visitor. The GitHub Pages frontend never contacts an
Ethereum RPC or performs a historical backfill.

## Deploy

Use Node 24 and run from this directory:

```sh
npm ci
npm test
npx wrangler login
npx wrangler deploy
```

The deployment creates one Worker and one SQLite-backed Durable Object namespace.
The deployed configuration uses the public, keyless `https://rpc.mevblocker.io`
with 20-request batches. PublicNode and dRPC returned rate-limit errors from
Cloudflare during deployment. For a different provider, keep any credentialed URL private:

```sh
npx wrangler secret put RPC_URL
```

Set `RPC_BATCH_SIZE` to the provider's supported limit (1–20; fallback 3).
The deployed service is
`https://ammonitor-price-feed.ammonitor-price-feed.workers.dev/v1/prices`;
its uncached status endpoint is `/health`. A complete 48-hour backfill and
background updates were verified on November 4, 2026.

Set `dashboard_data/live_price_config.json` in the blog repository to:

```json
{"endpoint":"https://<actual-worker-host>/v1/prices"}
```

Use the hostname Wrangler actually returns. Publish that frontend change using
the existing GitHub Pages process. No GitHub scheduled job is required. An empty
endpoint keeps the original daily-snapshot dashboard working.

## Behaviour and verification

`GET /v1/prices` serves one shared snapshot with public CORS and a 20-second edge
cache. Its first request schedules the initial collection; it may return 503 with
`status: warming_up`. `GET /health` reports collection timestamps and status.
There is no public write/refresh endpoint. Subsequent reads do not contact RPC.

The native 15-minute cron updates the collector while nobody is viewing the page.
During initial backfill, Durable Object alarms process bounded chunks every five
seconds. A first 48-hour backfill can take several minutes. New Cron Trigger
configuration can take up to 15 minutes to propagate; initial warming also uses
an alarm. Alarms retry failed collections after 15 minutes to avoid amplifying rate limits. Concurrent triggers
share the same in-flight collection.

The service verifies Ethereum chain ID, pool token ordering, fee tier and both
tokens' decimals. It decodes the canonical Swap event and samples minute-end
spot prices, carrying state forward only over verified blocks between swaps.
Raw token1/token0 is already human-scale USDT/USDC because both tokens have six
decimals. It independently cross-checks the decoded end state against `slot0`.

The latest quote and history stop **12 blocks behind the head** to reduce reorg
exposure. This means the display is near-live, a few minutes behind the
chain head at collection, with up to another 15 minutes between updates. The cursor's block hash is rechecked on each update. A mismatch
rebuilds the rolling history. Providers with narrow log-query limits are handled
by reducing the block chunk, without skipping blocks. If historical `eth_call`
is unavailable, history starts at the first verified swap rather than inventing
an initial price.

RPC failures retain the last successful snapshot. The browser marks it stale
after twenty minutes, keeps the daily model forecast at its original origin, and
shows gaps instead of interpolating incomplete backfills. A forecast that has
passed its 24-hour horizon is labelled as ended. Live quotes never update the
daily RF score or rerun ANGEL.

The default configuration is compatible with SQLite-backed Durable Objects on
Cloudflare's free tier; actual quotas and provider availability still apply.
`HISTORY_HOURS` is bounded to 1–72 and `BLOCK_CHUNK` to 1–400. Secrets, local
Wrangler state and `node_modules` are ignored by Git; the entire service directory
is excluded from the Jekyll site output.

## Local checks

```sh
npm test
npm run check
npm run dev
# Trigger the local scheduled handler:
curl 'http://localhost:8787/__scheduled?cron=*+*+*+*+*'
curl 'http://localhost:8787/v1/prices'
```

The tests cover ABI hash/decoding, minute-close sampling, incremental cursors,
range-limit handling, log/slot0 consistency, malformed feeds and chart gaps.
