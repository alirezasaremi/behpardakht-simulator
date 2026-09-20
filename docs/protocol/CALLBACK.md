# Callback

## Documented callback (`PROTOCOL`)

After banking operation, gateway POSTs following values to `callBackUrl` supplied with `bpPayRequest`:

| Field | Source type | Source meaning |
| --- | --- | --- |
| `RefId` | `string` | Payment-request reference generated with Pay. |
| `ResCode` | `string` | Purchase status; response-code catalogue applies. |
| `SaleOrderId` | `long` | Purchase request number. |
| `SaleReferenceId` | `long` | Purchase transaction reference provided by bank. |
| `CardHolderPan` | `string` | First six and final four card digits. |
| `CreditCardSaleResponseDetail` | `string` | Credit-purchase response detail. |
| `FinalAmount` | `long` | Final cardholder-debited amount in online discount scheme. |

Before calling Verify, merchant must verify callback `RefId` and `SaleOrderId` exactly match `RefId` and original Pay `orderId` for same transaction. If mismatched, source requires merchant treat transaction invalid and not call `bpVerifyRequest`.

`callBackUrl` must be within merchant registered domain. Local simulator must additionally use an allowlist and SSRF protections; that is `SIMULATOR_INTERNAL`, not claimed source behavior.
