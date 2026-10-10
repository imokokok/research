# x402 settlements on a paid agent endpoint: a first-party audit

**Snapshot:** 2026-10-10, blocks 52,100,000–52,407,864 on Base mainnet.
**Author context, declared up front:** this is an audit of our own pay-to address. We are the operator of the endpoint, which is both the reason we can do the attribution below and a bias you should price in.

## Question

Once a machine-payable agent API is live and discoverable, how much real money flows into it — and who is actually paying?

## Setup

- Endpoint: `oracleinsight.xyz` — pre-trade safety check ($0.02, C3) and MCP tools ($0.002+, C1–C4), x402-native (USDC on Base, EIP-3009), dual-rail with MPP sharing the same pay-to address.
- Live since 2026-10-06. Discovery via `/.well-known/x402.json`, `llms.txt`, `openapi.json`; indexed by x402scan.
- Pay-to: `0x5fbbbcbf2ade44f5c604e5e55f11945e1addd231`.

## Method

- Full `Transfer` event scan of Base USDC (`0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`) via `eth_getLogs`, filtered to `to = payTo`, covering the entire live window (52,100,000 → head).
- Chunked requests (≤ 9,999 blocks), 8 retries with backoff per chunk, every failed chunk recorded as an explicit gap. No conclusions drawn from partial data.
- Cross-checked against two independent sources: the x402scan server dashboard and Blockscout token transfers, plus the live `balanceOf`.

Reference implementation: [`scripts/x402-usdc-in-archive.mjs`](../scripts/x402-usdc-in-archive.mjs).

## Data

All 9 transfers received (UTC):

| Time | From | Amount | Nature |
|---|---|---|---|
| 10-06 18:26 | `0x1BF1…1DeC` (self) | 0.020 | self test |
| 10-07 05:23 | `0x1BF1…1DeC` (self) | 0.020 | self test |
| 10-07 13:05 | `0x1BF1…1DeC` (self) | 0.002 | self test (C1 `get_symbols`) |
| 10-07 14:51 | `0x1BF1…1DeC` (self) | 0.020 | self test |
| 10-07 15:31 | `0xc9c7…1670` | 0.020 | external ① — [tx](https://base.blockscout.com/tx/0x2aaa98250f21a40b179530159d6d4272af4ee8eb60414b960d579eb03a49978c) |
| 10-08 05:39 | `0x6A0B…4518` | 0.020 | external ② — [tx](https://base.blockscout.com/tx/0xe41da8f85d3a635fcdce79e33daa1b6526eb6f80eca7340c4136441a71b0961e) |
| 10-09 15:39 | `0x7E6b…2b1c` | 0.020 | external ③ — [tx](https://base.blockscout.com/tx/0xa1bfc1ce571aaa2d6ff0f98ac460846b518381ebefd36eb061b4cb42176f7c90), block 52,385,513 |
| 10-09 18:37 | `0x1BF1…1DeC` (self) | 0.020 | self test (circuit-breaker, BLOCK) |
| 10-09 18:40 | `0x1BF1…1DeC` (self) | 0.020 | self test (circuit-breaker, PASS) |

Full addresses: external ① `0xc9c7b38c0942914fc8ea12063bc92dcd3b581670`, ② `0x6a0b784cf4e3f79e0bca889e35a1b3aa1dc24518`, ③ `0x7e6b6556322c4e26c567a867964ac793f5ee2b1c`.

## Findings

1. **Total flow: 9 settlements, 0.162 USDC, 4 unique payers.** The `eth_getLogs` scan, the x402scan dashboard (9 tx / $0.16 / 4 buyers), and Blockscout (9 transfers) agree exactly, and the sum matches the live `balanceOf`.
2. **External demand is real but small.** Three external EOAs, one $0.02 payment each, one per day since listing — with zero outreach on our side. None of the three appears in any partner, outreach, or self-test record.
3. **Same client toolchain, not hand-rolled calls.** All three external payments are USDC `transferWithAuthorization` (EIP-3009) submitted by the same x402 facilitator (`0x68A96F41…7863`) — three independent operators arrived through the same standard stack.
4. **Buyer profiles look like working agent wallets.** Pure EOAs (code length 0), no ENS; external ③ carries 50+ historical token transfers — active wallets, not one-shot test addresses.
5. **Attribution without cookies.** On-chain payment timestamps align with server-side `pre_trade_checks` rows: external ② paid at 10-08 05:39:57Z, matching a CAUTION-verdict check row at 05:39:53Z. Payment → server execution → persistence is verifiable from first-party logs plus chain data.
6. **Self-pay is 6 of 9 settlements (0.102).** Our own x402 and MPP tests — including the two circuit-breaker verifications — are indistinguishable from revenue at index level. **A caution for anyone reading public x402scan dashboards: developer self-tests inflate apparent "buyers" and volume.**

## Caveats

- One endpoint, one pay-to address, roughly four days, n = 3 external. No extrapolation to ecosystem-wide revenue.
- Index lag is real: the x402scan dashboard's `latest_block_timestamp` froze at 10-09 18:40:59Z while the chain moved on; treat index stats as trailing, not live.
- All external payments hit the same $0.02 tier; no data on willingness to pay at higher price points.
