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

## Verify (`bpVerifyRequest`)

`bpVerifyRequest` returns a string containing a response code (printed page 21). Its exact source fields are `terminalId`, `userName`, `userPassword`, `orderId`, `saleOrderId`, and `saleReferenceId`; types are respectively `long`, `string`, `string`, `long`, `long`, and `long`.

Verify `orderId` is verification-request number, does not need to be unique, and may equal `saleOrderId`. `saleOrderId` is purchase-request number: original Pay `orderId`; `saleReferenceId` is purchase transaction reference. Callback `ResCode` `0` requires Verify; nonzero callback `ResCode` must not be conflated with Verify response. Source retry wording names success, previously verified, or previously reversed. Source table 11 explicitly defines `43` as prior successful Verify; it defines `48` as reversed, but Goal 5 has no completed-reversal state and does not return it. See [VERIFY.md](VERIFY.md).

## Settle, Inquiry, Reversal, VerifySettle

Each source table gives same field structure. Return value is a response-code string, except source describes `0` for `bpSettleRequest` as successful receipt of settlement request.

| Operation | `terminalId` | `userName` | `userPassword` | `orderId` | `saleOrderId` | `saleReferenceId` |
| --- | --- | --- | --- | --- | --- | --- |
| `bpVerifyRequest` | `long` | `string` | `string` | `long` | `long` | `long` |
| `bpSettleRequest` | `Long` | `String` | `String` | `Long` | `Long` | `Long` |
| `bpInquiryRequest` | `long` | `string` | `string` | `long` | `long` | `long` |
| `bpReversalRequest` | `long` | `string` | `string` | `long` | `long` | `long` |
| `bpVerifySettleRequest` | `long` | `string` | `string` | `long` | `long` | `long` |

Source says the later-operation `orderId` need not be unique and may equal `saleOrderId` for convenience. `saleOrderId` is purchase request number (Pay-stage `orderId`); `saleReferenceId` is bank-provided purchase reference used in Verify and later operations.

## POST semantics

Successful Pay sends `RefId` by POST to payment page. After banking operation, payment page sends seven callback values by POST to `callBackUrl`: `RefId`, `ResCode`, `SaleOrderId`, `SaleReferenceId`, `CardHolderPan`, `CreditCardSaleResponseDetail`, and `FinalAmount` (printed page 33). Merchant must correlate callback `RefId` and `SaleOrderId` exactly to original Pay `RefId` and `orderId` before Verify.

See [StartPay](START_PAY.md) for production URLs and optional POST fields. No callback encoding/content type, StartPay response/redirect behavior, browser UI, callback retry, or transport outcome mapping is asserted by v1.39.
