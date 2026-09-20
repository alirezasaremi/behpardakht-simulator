# Reversal (`bpReversalRequest`)

## Source-backed contract (`PROTOCOL`)

Printed pages 23-24 table 5 gives exact case-sensitive fields: `terminalId` (`long`), `userName` (`string`), `userPassword` (`string`), `orderId` (`long`), `saleOrderId` (`long`), and `saleReferenceId` (`long`). Reversal `orderId` need not be unique and may equal `saleOrderId`.

Printed page 23 describes exceptional uncertain payment: merchant withholds goods/services and asks bank to return amount if debited. It says method must follow a `bpVerifyRequest` call, reverse announcement maximum is three hours after Verify, and return is response-code string. It does not state Verify result must be unknown, permit/prohibit Reversal after successful Verify, name a Reversal response code, or say `0` means request acceptance/completed reversal.

Printed page 24 separately says maximum time to return debited amount at `bpReversalRequest` call is end current day, provided no settlement request was made. It does not reconcile this deadline with page-23 three-hour announcement.

## Goal 7 local behavior (`SIMULATOR_INTERNAL`, unless marked)

Local SOAP parses table-5 fields and resolves complete `{ terminalId, saleOrderId, saleReferenceId }` correlation. It requires local record of prior Verify invocation (`ATTEMPTED` or `VERIFIED`), from page-23 ordering sentence. It does **not** distinguish `ATTEMPTED` from `VERIFIED` as provider eligibility: source does not specify distinction. It rejects local settlement-requested state as `DERIVED` conservative policy from page-24 no-settlement condition; source does not explicitly state inverse/result behavior. Neither timing deadline is enforced.

No provider success/result is source-backed. Eligible-form requests return local `Client.InvalidReversalRequest` SOAP Fault without state mutation. No local Reversal SOAP call records `REVERSED`, request acceptance, callback, refund, or money movement.

`REVERSED` / `REVERSAL_COMPLETED` remains `SIMULATOR_INTERNAL` representation of known reversed state, used only to model source-backed later Verify `48`; it is not bpReversalRequest success result.

Goal 9 additionally makes known reversed state reachable with `KNOWN_REVERSED` (`SIMULATOR_SCENARIO`) local control. It requires successful Sale, unresolved verification, no settlement as simulator safety rules, records `SCENARIO_STATE_FORCED`, never `REVERSAL_COMPLETED` or merchant Reversal call. This does not add provider Reversal result.

## Provider response audit

`0` is **GLOBAL only**: table 11 says transaction completed successfully, but Reversal section has no operation-specific `0`, example, or lifecycle mapping. Goal 7 returns no Behpardakht code from Reversal. Table-11 `48` likewise does not establish Reversal repeat response.

## VerifySettle interaction

Page 32 explicitly names prior `reverse` as `bpVerifySettleRequest` retry outcome; table 11 maps that named state to `48`. Goal 8 returns `48` only for simulator's existing known `REVERSED` state and does not make `bpReversalRequest` create it or gain a provider result.
