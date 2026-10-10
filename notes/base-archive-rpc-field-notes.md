# Base archive RPC field notes

**Snapshot:** 2026-10-10. Scope: deep-historical `eth_getLogs` on Base mainnet without paid infrastructure.

## Question

You need ~1.2 million blocks of historical USDC `Transfer` logs on Base. Public RPCs mostly cap log queries or lack archive depth. What actually works for free?

## What worked

As of the snapshot date, one public endpoint served full archive `eth_getLogs` without a key:

- **`https://rpc-base.blockmachine.io`** — free, no key, `chainId 0x2105`, answered archive-range queries down to block 52,100,000.

## What it costs

The endpoint is rate-limited tightly. A naive full-range scan will fail partway and — worse — fail **silently**, returning fewer logs than exist. The workable pattern:

1. **Chunk** the range (we used ≤ 9,999 blocks per `eth_getLogs` call).
2. **Retry** each chunk up to 8 times with increasing backoff (1.2 s × attempt).
3. **Record every chunk that still fails as an explicit gap**, re-run gaps separately, and refuse to conclude anything while gaps remain open.
4. **Reconcile the total** against an independent source (Blockscout transfer count, live `balanceOf`) so silent truncation cannot pass unnoticed.

## What did not work

The default public Base endpoints we tried either rejected deep archive ranges outright or throttled batched log queries past usability. Specific behavior changes over time — the point of this note is the **pattern** (chunk / retry / explicit gaps / reconcile), not the permanent status of any single URL.

## Reference implementation

[`scripts/x402-usdc-in-archive.mjs`](../scripts/x402-usdc-in-archive.mjs) — chunked archive scan with retries, gap reporting, and cross-source reconciliation, used for the [x402 settlements audit](x402-settlements-first-party-audit.md).
