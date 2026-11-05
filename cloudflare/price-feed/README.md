# Shared Uniswap price feed

A Cloudflare Worker collects the USDC/USDT v3 0.01% pool every 15 minutes using
Cloudflare Cron Triggers. One SQLite-backed Durable Object owns the cursor and
minute prices since the latest published ANGEL forecast origin for every visitor.
The GitHub Pages frontend never contacts an
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
its uncached status endpoint is `/health`. The previously deployed rolling
48-hour collector and background updates were verified on November 5, 2026.
The forecast-origin retention change must be deployed to replace that behavior.

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
`status: warming_up`. `GET /health` reports collection timestamps, status,
`forecast_origin`, `history_start`, `retention_basis`, and `stored_points`.
There is no public write/refresh endpoint. Subsequent reads do not contact RPC.

The native 15-minute cron updates the collector while nobody is viewing the page.
During initial backfill, Durable Object alarms process bounded chunks every five
seconds. A first intraday backfill can take several minutes. New Cron Trigger
configuration can take up to 15 minutes to propagate; initial warming also uses
an alarm. Alarms retry failed collections after 15 minutes to avoid amplifying rate limits. Concurrent triggers
share the same in-flight collection.

Before collection, the Durable Object reads `FORECAST_URL`, defaulting to the
published `dashboard_data/angel_forecast.json` on this GitHub Pages site. Its
verified ANGEL timestamp is the retention boundary. The origin is checked at
most once every 15 minutes on successful requests, with ETag revalidation;
five-second backfill continuations reuse it. Earlier minute samples are pruned
when the origin advances. The block cursor remains incremental, so a new daily
forecast does not re-query the previous day's blocks. Cold starts and reorg
rebuilds backfill only the retained window. Raw swaps and queried block headers
are temporary in-memory data, not stored history.

`HISTORY_HOURS=48` is an additional maximum age if model publication stops, not
an instruction to retain prices before the forecast origin. The effective
boundary is the later of the origin and that safety cutoff. If the published
forecast is unavailable or invalid, the collector retains the last quote and
bounded history, marks the feed degraded, and retries after 15 minutes. It does
not start an unbounded or origin-free RPC backfill. Without any verified origin,
old history is cleared and reconstructed after the forecast source recovers.

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

## Free-tier usage audit

Cloudflare's relevant Free plan operation limits reset **daily at 00:00 UTC**.
They are not monthly cumulative quotas. Limits are shared with other workloads
on the account. Checked against the official
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and
[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
on November 5, 2026:

| Resource | This collector | Free allowance |
| --- | --- | --- |
| Scheduled collections | 96/day; 2,976 in a 31-day month | One of five available Cron Triggers |
| Worker requests | 604 observed in the preceding 24 hours, including dashboard traffic | 100,000/day |
| Durable Object calls | 505 observed in the preceding 24 hours, including backfill alarms and reads | 100,000/day |
| Snapshot writes | About 96/day after catching up; one overwritten SQLite row per collection, plus alarm writes during backfill/retries | 100,000 rows written/day |
| Stored price payload | Previously 2,880 minute prices, 300,376 response bytes; typically about half that for a daily origin | 5 GB total SQLite storage |
| Durable Object duration | At most 10,800 GB-s/day for this single 128 MB object, even if active all day; normally much less | 13,000 GB-s/day |

The live feed returned `status: ok`, with no collection error. Worker analytics
reported no invocation errors; its successful-request CPU P99 was 9.852 ms
(Free Workers allow 10 ms per invocation). These are observations, not future
traffic guarantees. The saved login could read deployment settings and analytics
but could not read billing subscriptions, so this audit does not certify which
billing plan the account currently subscribes to.

Price storage does **not** grow by 300 KB every collection. Each `put('snapshot',
...)` replaces the same value; it does not create a new historical snapshot.
Minute prices are kept so all visitors and page reloads share the same intraday
chart without independent RPC backfills. The monthly retention regression test
simulates 2,976 collections and confirms daily pruning and a bounded snapshot.
Its constant-price fixture is smaller than real prices, so it is not a measured
production storage bill. SQLite page/index overhead is additional to JSON size.

Traffic is the main variable: an open dashboard polls once a minute while
visible, or about 1,440 requests over 24 hours. Roughly 70 continuously visible
dashboards could reach the Worker request cap. The 20-second edge cache reduces
Durable Object reads, but cache hits still count as Worker requests. More traffic
would require a slower polling interval or a different serving strategy. Free
quota exhaustion causes failed operations rather than automatic paid overages
when the account is actually on Workers Free. Public Ethereum RPC availability
and provider rate limits are separate from Cloudflare allowances.

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
