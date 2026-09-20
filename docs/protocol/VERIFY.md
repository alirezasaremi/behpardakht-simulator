# Verify (`bpVerifyRequest`)

## Source-backed contract (`PROTOCOL`)

v1.39 printed page 21, table 2, defines `bpVerifyRequest`. It returns a string containing one response code. It is called after payment-page callback: callback `ResCode` `0` means Sale succeeded on payment page and merchant must call Verify to confirm bank-side transaction. Callback `ResCode` and Verify result are distinct values.

| Field | Type | Source meaning |
| --- | --- | --- |
| `terminalId` | `long` | Merchant terminal number. |
| `userName` | `string` | Merchant username. |
| `userPassword` | `string` | Merchant password. |
| `orderId` | `long` | Verification-request number. |
| `saleOrderId` | `long` | Purchase-request number; same as prior Pay-stage `orderId`. |
| `saleReferenceId` | `long` | Purchase transaction reference. |

`orderId` does not need to be unique and may equal `saleOrderId`. It is not Pay `orderId`, and it is not a Sale lookup key. Callback `SaleOrderId` is original Pay `orderId`; before Verify merchant must have already checked callback `RefId` and `SaleOrderId` against that Pay request (printed page 33).

If callback `ResCode` is nonzero, printed page 21 tells merchant to call Verify again until it receives success, previously verified, or previously reversed. This is retry direction, not a statement that callback nonzero equals a Verify response code.

For a successful Sale, no Verify request within 20 minutes causes gateway automatic reversal request; source says funds return to cardholder. Source does not define timer implementation or a Verify result for an elapsed local clock.

## Goal 5-7 local behavior (`SIMULATOR_INTERNAL`, unless marked)

`POST /api/soap` accepts local SOAP profile operation `bpVerifyRequest` with exactly table-2 fields. Decimal `long` values are parsed directly to `bigint`. The service resolves only complete `{ terminalId, saleOrderId, saleReferenceId }` Sale correlation. It neither looks up by nor enforces uniqueness on Verify `orderId`. `userName` and `userPassword` are accepted as compatibility fields only; neither is persisted, logged, emitted in history, or returned.

For a correlated successful Sale, simulator appends `VERIFY_ATTEMPTED`, then `VERIFICATION_CONFIRMED`, saves one immutable final snapshot, and returns `0`. Sale correlation values stay unchanged. Settlement stays `NOT_REQUESTED`; no callback is sent. A subsequent correlated Verify returns `43` and adds no event. Goal 7 adds internal known `REVERSED`: a later correlated Verify returns `48` without event/mutation because page 21 expressly names previous reversal as Verify result. `bpReversalRequest` does not currently create this state.

Goal 9's `VERIFY_UNRESOLVED` is `SIMULATOR_SCENARIO`: after source-backed correlation/eligibility, it saves `VERIFY_ATTEMPTED`, returns local HTTP 409 SOAP Fault `SimulatorScenario.VerifyUnresolved`. It never returns Behpardakht numeric ResCode because v1.39 supplies no operation-specific unresolved Verify code. Repeated calls append attempts, fault identically; clear permits later normal atomic Verify, preserves earlier events. Inquiry unchanged. `NORMAL` remains prior atomic path. No timer, automatic reversal, refund exists.

## Provider response audit

| Code | Source meaning | Exact Goal 5 condition | PDF basis | Classification |
| ---: | --- | --- | --- | --- |
| `0` | Transaction completed successfully. | Correlated successful Sale is confirmed. | Printed page 21: Verify returns response code; printed page 36 table 11 code `0`. | `PROTOCOL` mapping; local state mutation is `SIMULATOR_INTERNAL`. |
| `43` | Verify request already made; prior verification succeeded. | Correlated transaction is already verified. | Printed page 21 retry wording; printed page 37 table 11 code `43`. | `PROTOCOL`. |
| `48` | Transaction reversed. | Correlated transaction completed local Reversal. | Printed page 21 explicitly names previously reversed Verify result; printed page 37 table 11 code `48`. | `PROTOCOL` mapping; reversal lifecycle is `SIMULATOR_INTERNAL`. |

`42` Sale not found is not returned: table 11 explains its matching-Sale condition specifically for refund, not Verify. Unknown or mismatching Verify correlation is a local SOAP fault, never an invented provider code.

## VerifySettle interaction

Printed page 32 separately makes previous `verify` an explicit `bpVerifySettleRequest` retry result. Goal 8 returns `43` from VerifySettle after confirmed separate Verify and does not continue to local settlement. Verify behavior itself remains unchanged.
