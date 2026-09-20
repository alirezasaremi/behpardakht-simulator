# Settle (`bpSettleRequest`)

## Source-backed contract (`PROTOCOL`)

v1.39 printed page 22, table 3, defines `bpSettleRequest` as merchant settlement/deposit request. Return value: string containing response code. Page says operation finalizes settlement work for verified transactions; `0` means merchant settlement request received successfully.

| Field | Source type | Source meaning |
| --- | --- | --- |
| `terminalId` | `Long` | Merchant terminal number. |
| `userName` | `String` | Merchant username. |
| `userPassword` | `String` | Merchant password. |
| `orderId` | `Long` | Settlement-request number. |
| `saleOrderId` | `Long` | Purchase-request number: original Pay `orderId`. |
| `saleReferenceId` | `Long` | Purchase transaction reference used in Verify. |

Table 3 says Settle `orderId` need not be unique and may equal `saleOrderId`. It is not Sale correlation. Local correlation: `{ terminalId, saleOrderId, saleReferenceId }`; `saleOrderId` derives from Pay `orderId`; `saleReferenceId` is completed Sale reference.

Page 22 establishes settlement for verified transactions. It gives no Settle-specific result for unknown Sale, mismatched correlation, wrong terminal, or pre-Verify Settle. Table 11 includes `45`, `46`, `47`, `61`, but neither page 22 nor Settle retry text ties nonzero code to `bpSettleRequest`. `45` not implemented from catalogue wording alone.

## Goal 6-7 local behavior (`SIMULATOR_INTERNAL`, unless marked)

`POST /api/soap` accepts six exact table-3 names. Decimal `Long` values parse directly to `bigint`. `userName`/`userPassword` are compatibility input only; neither persists, logs, appears in events/faults/UI.

Correlated successful Sale plus confirmed Verify appends `SETTLEMENT_REQUESTED` with `via: "SETTLE"`, preserves Sale `SUCCEEDED` and Verify `VERIFIED`, sets settlement `REQUESTED`. This records accepted Settle lifecycle request, not banking ledger, proof of deposit, or real money movement. No callback.

Rejected correlation, pre-Verify, repeated Settle, malformed, and invalid requests save no event/snapshot. Source does not establish their provider codes; local SOAP Fault. No real credentials, auto-settlement, timers, workers, or refund.

## Provider response audit

| Code | Source meaning | Goal 6 condition | Exact basis | Classification |
| ---: | --- | --- | --- | --- |
| `0` | Successful receipt of merchant settlement request. | Fully correlated verified Sale records accepted settlement request. | Printed page 22, `bpSettleRequest` text/table 3. | `PROTOCOL` mapping; domain record `SIMULATOR_INTERNAL`. |

No nonzero Behpardakht response code returns from `bpSettleRequest` in Goal 6.

## Timing and reversal (`PROTOCOL`, not implemented)

Printed page 20: successful transactions without merchant reversal/settlement request settle on merchant behalf after three hours (180 minutes). StartPay `RefId` plus any string `SettleTime` changes settlement time to six hours (360 minutes). Page 22 separately describes merchant-requested Settle; it does not define how automatic rules change Settle outcomes. Page 24 Reversal note says no settlement request for end-of-day reversal. Goal 7 rejects local settlement-requested Reversal but does not infer inverse `Reversed -> Settle` provider rule; no timer, `SettleTime` intake, or auto-action exists.

## VerifySettle interaction

Page 32 explicitly names previously settled as `bpVerifySettleRequest` retry outcome; table 11 maps it to `45`. Goal 8 returns `45` from combined VerifySettle after separate Settle or combined success, without mutation. This does not alter Goal 6: repeated `bpSettleRequest` remains local fault because page 22 does not tie `45` to its retry.
