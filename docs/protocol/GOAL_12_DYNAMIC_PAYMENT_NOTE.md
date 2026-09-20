# Goal 12 implementation note: `bpDynamicPayRequest`

## Selected capability and source

`bpDynamicPayRequest`, v1.39 printed pages 28-29, table 9. Printed pages 9-10 say Type Two payment follows Pay-like confirmation, settlement, reversal, and inquiry workflow.

## Exact documented request and response

Table 9 names: `terminalId` long, `userName` string, `userPassword` string, `orderId` long, `amount` long, `localDate` string, `localTime` string, `additionalData` string (maximum 1000 characters), `callBackUrl` string, `payerId` string, `subServiceId` long; optional `mobileNo`, `encPan`, `panHiddenMode`, `cartItem`, and `enc` strings.

The illustrated result is `0,RefId`. On `0`, generated case-sensitive `RefId` is POSTed for the next payment-page stage. Source requires unique Dynamic Pay `orderId`. It says nonzero results require a new RefId/new call, but does not name a Dynamic-Pay-specific code.

## State effects and unresolved questions

`DOCUMENTED / PROTOCOL`: request creation then RefId/Pay-like later workflow.

`SIMULATOR_INTERNAL`: existing transaction records normal local request/Sale lifecycle and an operation discriminator for safe diagnostics. Terminal-wide `orderId` uniqueness across Pay/Dynamic Pay prevents ambiguous local identity; it is not provider behavior. `subServiceId` is request-only and discarded: no payout/provider provisioning exists.

`UNSPECIFIED`: Dynamic-Pay nonzero mappings, provider sub-service validation, exact schema/envelope, credentials, callback-wire differences and provider cross-operation `orderId` uniqueness.

## Conservative safety decisions

Normal non-sensitive fields are accepted. Optional `mobileNo`, `encPan`, and `enc` are rejected locally because they may contain personal/card/identity data. `panHiddenMode` and `cartItem` may be syntactically accepted but are discarded. No PAN, encrypted PAN, national ID, mobile number, PIN, CVV2, OTP, credentials, or key material is stored, logged, rendered, or returned.

No scenario, transport-fault, timer, payout, automatic settlement, callback format, or dashboard redesign is added. Existing Verify/Settle compatibility follows direct high-level Dynamic Pay continuation evidence. Source does not establish VerifySettle for Dynamic Pay; current shared local VerifySettle handler does not distinguish request operation, so that path is `SIMULATOR_INTERNAL` compatibility, not a Dynamic-Pay provider claim.

Printed pages 9-10 directly support Pay-like confirmation, settlement, reversal, and inquiry. They do not directly name StartPay URL, callback field shape, or VerifySettle for Dynamic Pay; those remain `DERIVED`/`UNSPECIFIED` as appropriate.
