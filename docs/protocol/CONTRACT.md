# Contracts

All facts here are `PROTOCOL`, from v1.39; source uses case-sensitive names and says parameter spelling/case matter. It does **not** establish SOAP namespace, SOAPAction, WSDL schema content, envelope, operation wrapper, or serialization details. Source printed page 12 lists provider test/operational WSDL URLs; those locations do not establish their wire schema.

## Pay (`bpPayRequest` / `bpChargePayRequest`)

Pay returns a string with two parts: `ResCode` then, on successful `ResCode` `0`, `RefId`; source illustration: `0, AF82041a2Bf6989c7fF9`. `RefId` is case-sensitive. `orderId` must be unique for Pay requests. On successful Pay, POST `RefId` to documented payment-page redirect destination. Exact public gateway URLs are intentionally not simulator configuration.

| Parameter | Source type | Notes |
| --- | --- | --- |
| `terminalId` | `long` | Merchant terminal number. |
| `userName` | `string` | Merchant username. |
| `userPassword` | `string` | Merchant password. |
| `orderId` | `long` | Payment request number; unique for Pay. |
| `amount` | `long` | Purchase amount. |
| `localDate` | `string` | `YYYYMMDD`. |
| `localTime` | `string` | `HHMMSS`. |
| `additionalData` | `string` | Optional accompanying data; source states max 1000 characters. |
| `callBackUrl` | `string` | Merchant return address; must be in registered merchant site domain. |
| `payerId` | `string` | Payer identifier. |
| `mobileNo` | `string` | Optional cardholder mobile number. |
| `encPan` | `string` | Optional encrypted card number. |
| `panHiddenMode` | `string` | Optional fixed-card display mode. |
| `cartItem` | `string` | Optional merchant display text. |
| `enc` | `string` | Optional encrypted cardholder national ID; required for documented Mana brokerage case. |

`callBackUrl` domain rule and source redirect `Referer` domain comparison are protocol facts. Simulator allowlisting/SSRF controls are additional `SIMULATOR_INTERNAL` security requirements.

Goal 3 implements only source table-1 field extraction. Table marks `mobileNo`, `encPan`, `panHiddenMode`, `cartItem`, and `enc` optional. It marks `enc` required only for documented Mana brokerage use; Goal 3 has no merchant-category configuration and cannot determine that condition. Source gives `additionalData` maximum 1000 characters and syntax examples `YYYYMMDD` / `HHMMSS` for `localDate` / `localTime`.

Source table 11 labels `41` “duplicate request number,” while Pay notes say duplicate `orderId` returns an error. v1.39 never explicitly connects `41` to duplicate `bpPayRequest` / `orderId`; provider result code and non-success result grammar for this condition are `UNSPECIFIED`. Goal 3 preserves terminal-scoped uniqueness internally and returns a `SIMULATOR_INTERNAL` HTTP 409 SOAP Fault for duplicates. No Goal 3 condition maps to a Behpardakht response code beyond documented success `0,RefId`.

## Dynamic Pay (`bpDynamicPayRequest`)

Printed pages 28-29/table 9 define Type Two Dynamic Pay. It has the Pay request fields plus `subServiceId` (`long`), a dynamically selected payout-account identifier. `mobileNo`, `encPan`, `panHiddenMode`, `cartItem`, and `enc` are optional. `additionalData` has a 1000-character maximum. Source illustrates `0,RefId`; `0` causes case-sensitive RefId POST to next stage. Dynamic Pay `orderId` must be unique. Printed pages 9-10 say later confirmation, settlement, reversal, and inquiry follow Pay-like flow.

Goal 12 implements only safe normal-path table-9 input. `subServiceId` parses as `bigint` then is discarded; `paymentOperation: "DYNAMIC_PAY"` is a `SIMULATOR_INTERNAL` diagnostic discriminator, not new provider state. Local input rejects optional `mobileNo`, `encPan`, and `enc` to prevent personal/card/identity data intake; it accepts/discards `panHiddenMode` and `cartItem`. Provider cross-operation request-number collisions, nonzero Dynamic Pay response codes, provisioning/validation, exact wire schema, and callback differences are `UNSPECIFIED`; no table-11 code is inferred. Local repository rejects same `terminalId + orderId` across Pay/Dynamic Pay as `SIMULATOR_INTERNAL` ambiguity prevention.

## Verify (`bpVerifyRequest`)

`bpVerifyRequest` returns a string containing a response code (printed page 21). Its exact source fields are `terminalId`, `userName`, `userPassword`, `orderId`, `saleOrderId`, and `saleReferenceId`; types are respectively `long`, `string`, `string`, `long`, `long`, and `long`.

Verify `orderId` is verification-request number, does not need to be unique, and may equal `saleOrderId`. `saleOrderId` is purchase-request number: original Pay `orderId`; `saleReferenceId` is purchase transaction reference. Callback `ResCode` `0` requires Verify; nonzero callback `ResCode` must not be conflated with Verify response. Source retry wording names success, previously verified, or previously reversed. Source table 11 explicitly defines `43` as prior successful Verify and page 21 plus table 11 establishes `48` after completed Reversal. See [VERIFY.md](VERIFY.md).

## Settle (`bpSettleRequest`)

Settle printed page 22 table 3 fields: `terminalId`, `userName`, `userPassword`, `orderId`, `saleOrderId`, `saleReferenceId`; source types exactly `Long`, `String`, `String`, `Long`, `Long`, `Long`. `orderId` is settlement-request number, not required unique and permitted equal to `saleOrderId`. `saleOrderId` is original Pay purchase-request number; `saleReferenceId` is purchase reference from Verify. It returns response-code string; `0` means successful receipt of merchant settlement request. Source describes settlement work for verified transactions, but `0` is not a statement that merchant deposit completed. See [SETTLE.md](SETTLE.md).

## Inquiry (`bpInquiryRequest`)

Inquiry printed page 23 table 4 fields are `terminalId`, `userName`, `userPassword`, `orderId`, `saleOrderId`, and `saleReferenceId`, all typed `long`/`string`/`string`/`long`/`long`/`long`. Its `orderId` is inquiry-request number, need not be unique, and may equal `saleOrderId`; it is not Sale lookup key. Source calls Inquiry when merchant missed Verify result and says return is response-code string. It does not define rich status data or operation-specific results for verified/settled/reversed/unknown transactions. See [INQUIRY.md](INQUIRY.md).

## Reversal (`bpReversalRequest`)

Reversal printed pages 23-24 table 5 fields are `terminalId`, `userName`, `userPassword`, `orderId`, `saleOrderId`, and `saleReferenceId`, all typed `long`/`string`/`string`/`long`/`long`/`long`. Its `orderId` is reversal-request number, need not be unique, and may equal `saleOrderId`; it is not Sale lookup key. Source says it follows Verify in uncertain-payment purpose prose, but does not distinguish unknown/successful Verify eligibility. It states three hours after Verify for reverse announcement and end-of-day reversal of debited funds only without settlement request; precedence is unspecified. No operation-specific Reversal `0`/state effect is documented. See [REVERSAL.md](REVERSAL.md).

## VerifySettle (`bpVerifySettleRequest`)

Printed pages 31-32 table 12 fields are `terminalId`, `userName`, `userPassword`, `orderId`, `saleOrderId`, and `saleReferenceId`, with types `long`, `string`, `string`, `long`, `long`, and `long`. `orderId` is combined Verify/Settle request number, need not be unique, and may equal `saleOrderId`; it is not Sale lookup key. `saleOrderId` is original Pay purchase request number and `saleReferenceId` is purchase reference.

Page 32 directly identifies `0` for successful payment-page transaction and use of combined VerifySettle, then explicitly names retries ending in success, previously verified, settled, or reversed transaction. Table 11 maps those named states to `0`, `43`, `45`, and `48`. Callback `ResCode` `0` is documented normal workflow, not independently specified as provider validation invariant. See [VERIFY_SETTLE.md](VERIFY_SETTLE.md).

## POST semantics

Successful Pay sends `RefId` by POST to payment page. After banking operation, payment page sends seven callback values by POST to `callBackUrl`: `RefId`, `ResCode`, `SaleOrderId`, `SaleReferenceId`, `CardHolderPan`, `CreditCardSaleResponseDetail`, and `FinalAmount` (printed page 33). Merchant must correlate callback `RefId` and `SaleOrderId` exactly to original Pay `RefId` and `orderId` before Verify.

See [StartPay](START_PAY.md) for production URLs and optional POST fields. No callback encoding/content type, StartPay response/redirect behavior, browser UI, callback retry, or transport outcome mapping is asserted by v1.39.
