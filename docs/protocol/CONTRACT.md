# Contracts

All facts here are `PROTOCOL`, from v1.39; source uses case-sensitive names and says parameter spelling/case matter. It does **not** establish SOAP namespace, SOAPAction, WSDL schema, envelope, or serialization details.

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

## Verify, Settle, Inquiry, Reversal, VerifySettle

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

Successful Pay sends `RefId` by POST to payment page. After payment, payment page sends callback values by POST to `callBackUrl`. No other redirect form, browser behavior, SOAP wire behavior, or retry transport rule is asserted here.
