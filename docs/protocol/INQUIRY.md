# Inquiry (`bpInquiryRequest`)

## Source-backed contract (`PROTOCOL`)

Printed page 23 table 4 gives exact case-sensitive fields: `terminalId` (`long`), `userName` (`string`), `userPassword` (`string`), `orderId` (`long`), `saleOrderId` (`long`), and `saleReferenceId` (`long`). Inquiry `orderId` need not be unique and may equal `saleOrderId`.

Purpose, not gateway eligibility: printed pages 10 and 23 say merchant calls Inquiry when it did not learn Verify result. Page 23 says after call payment status becomes clear. It also says return is a string containing response code. It gives neither response-code value/example nor state-to-code mapping.

## Goal 7 local behavior (`SIMULATOR_INTERNAL`)

Local SOAP parses table-4 fields and resolves complete `{ terminalId, saleOrderId, saleReferenceId }` correlation. It does not require internal `ATTEMPTED`: purpose wording does not establish provider eligibility. It never persists/logs/renders credentials.

No provider response result is currently source-backed. Fully correlated requests return local `Client.InvalidInquiryRequest` SOAP Fault without mutation, event, lifecycle state, or status object. Unknown/mismatching/malformed requests fault locally too. This is conservative simulator behavior, not provider result claim.

## Provider response audit

`0` is **GLOBAL only**: table 11 says transaction completed successfully, but Inquiry section has no operation-specific `0`, example, or lifecycle mapping. Goal 7 returns no Behpardakht code from Inquiry.
