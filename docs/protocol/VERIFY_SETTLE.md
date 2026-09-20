# VerifySettle (`bpVerifySettleRequest`)

## Source-backed contract (`PROTOCOL`)

Printed pages 31-32, table 12, name exact operation `bpVerifySettleRequest`. It returns a string containing a response code. Exact case-sensitive fields: `terminalId` (`long`), `userName` (`string`), `userPassword` (`string`), `orderId` (`long`), `saleOrderId` (`long`), `saleReferenceId` (`long`). `orderId` is Verify/Settle request number, need not be unique, and may equal `saleOrderId`. `saleOrderId` is purchase-request number, explicitly same `OrderId` from purchase stage. `saleReferenceId` is purchase transaction reference.

Page 31 says merchant follows `RefId`; after cardholder payment, information is POSTed to merchant page and merchant considers callback `ResCode` against table 11 before invoking this method. Page 32 says callback `ResCode` `0` means successful payment-page transaction and says to use this method for bank-side transaction verification and settlement. Source describes normal successful-Sale workflow; it does not separately define provider behavior for an absent callback, callback transport failure, or a nonzero callback `ResCode`.

`0` is operation-specific: page 32 explicitly identifies it as successful payment-page transaction and prescribes `bpVerifySettleRequest` for its Verify/Settle work. Combined-method description on page 10 calls it simultaneous purchase confirmation and fund-deposit request; this simulator records no financial movement or deposit confirmation.

For nonzero VerifySettle result, page 32 explicitly says call `bpVerifySettleRequest` again until proper response: success, transaction previously `verify`d, previously `settle`d, or previously `reverse`d. Table 11 maps exactly those named states: `43` previously successful Verify, `45` settled, `48` reversed. Thus all source-supported local provider results are:

| Code | VerifySettle-specific condition | State mutation | Evidence | Classification |
| ---: | --- | --- | --- | --- |
| `0` | Correlated successful Sale, no local prior verification/settlement/reversal state. | Atomically records verified plus settlement requested. | Page 32 `0` note; page 10 combined-operation description. | `PROTOCOL` result; local state record `SIMULATOR_INTERNAL`. |
| `43` | Correlated transaction already confirmed by separate Verify. | None. | Page 32 retry names prior `verify`; table 11 maps it to `43`. | `PROTOCOL`. |
| `45` | Correlated transaction already has successful settlement request, whether through Settle or VerifySettle. | None. | Page 32 retry names prior `settle`; table 11 maps it to `45`. | `PROTOCOL`. |
| `48` | Correlated transaction is internal known `REVERSED`. | None. | Page 32 retry names prior `reverse`; table 11 maps it to `48`. | `PROTOCOL` result; known-reversed representation `SIMULATOR_INTERNAL`. |

No other table-11 row is tied to this operation. Global table wording alone never enables another VerifySettle result.

## Goal 8 local behavior (`SIMULATOR_INTERNAL`, unless marked)

`POST /api/soap` accepts table-12 fields. Decimal `long` text converts directly to `bigint`. `userName` and `userPassword` are compatibility input only; neither persists, logs, renders, enters events, or appears in faults.

Complete source-supported Sale correlation is `{ terminalId, saleOrderId, saleReferenceId }`; `orderId` is neither lookup key nor unique. This uses source-identical Sale identifiers but does not import Pay's `orderId` uniqueness rule.

For source-supported success, one immutable domain transition sets verification `VERIFIED` and settlement `REQUESTED` in one repository save. Rejection cannot expose a half-completed transition. Event history appends exactly one `SETTLEMENT_REQUESTED` event with `via: "VERIFY_SETTLE"`; it does not append `VERIFY_ATTEMPTED` or `VERIFICATION_CONFIRMED`, so it never claims merchant called separate SOAP Verify. This event shape is `SIMULATOR_INTERNAL` lifecycle representation.

After a separate successful Verify, VerifySettle returns `43` and does not request settlement. After either successful Settle or VerifySettle, it returns `45`. Internal known-reversed state returns `48`. These calls do not mutate history. A non-success Sale, unresolved Verify attempt, unknown/mismatched correlation, malformed request, or other unsupported local state returns local SOAP Fault without mutation; v1.39 provides no additional operation-specific result for those conditions.

VerifySettle sends no callback and performs no real bank/deposit/funds action. Separate Verify and Settle behavior remains unchanged.

## 20-minute statement (`PROTOCOL`, not implemented)

Page 32 says that for a transaction in successful `Sale` state, if merchant does not send `bpVerifySettleRequest` within 20 minutes, payment gateway sends automatic-reversal request to banking network; transaction is considered unsuccessful and money returns to cardholder account. Text establishes deadline against successful Sale, not a local callback-delivery timestamp. No timer, worker, request-time hidden reversal, or deterministic automatic-reversal scenario exists. Result after automatic reversal is source-backed `48` only when local state is already explicitly known reversed.

## Remaining uncertainties

- Callback `ResCode` `0` is normal source workflow for VerifySettle, but source does not define it as an independently enforced gateway validation rule.
- Source does not state whether an unresolved separate Verify attempt may later proceed through VerifySettle; local simulator faults rather than inventing outcome.
- Source does not define exact SOAP wire grammar, credential authentication, non-success-Sale result, or automatic-reversal simulation mechanics.
