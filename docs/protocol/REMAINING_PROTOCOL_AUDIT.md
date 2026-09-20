# Remaining protocol audit

## Scope and source

Goal 12 audited the complete supplied *Mellat PGW Technical Document v1.39* / *User Guide: Internet Payment Gateway Functions and Methods*, Behpardakht Mellat, Azar 1404. All 38 PDF pages were reviewed (cover plus printed pages 1-37). This audit used no WSDL fetch, web search, integration, package, or generic SOAP source.

Page references below are printed PDF pages. `DOCUMENTED / PROTOCOL` means direct v1.39 evidence; `DERIVED` is a narrow consequence; `SIMULATOR_INTERNAL` is local-only behavior; `SIMULATOR_SCENARIO` is test control; `UNSPECIFIED` is deliberately not filled in.

**Result-code rule:** table 11 (printed pages 35-37) is global catalogue evidence. It does not make a result operation-specific unless an operation section expressly connects its state/result to that code.

## Implemented inventory

| Capability | Evidence | Current representation |
| --- | --- | --- |
| `bpPayRequest` | pp. 14-17, table 1 | SOAP parsing, unique Pay request order, documented `0,RefId` success, local opaque RefId. |
| StartPay/Sale/callback | pp. 14, 18-21, 32-34 | Safe fake local page and callback boundary; no provider UI/card collection claim. |
| `bpVerifyRequest` | p. 21, table 2; table 11 | Correlation, `0`/`43`/`48` only where operation text supports them. |
| `bpSettleRequest` | p. 22, table 3 | Correlation and received-settlement-request `0`; no invented nonzero mapping. |
| `bpInquiryRequest` | pp. 22-23, table 4 | Exact parsing/correlation; local fault because no operation-specific code is supplied. |
| `bpReversalRequest` | pp. 23-24, table 5 | Exact parsing/correlation; local fault because success/state/result is not supplied. |
| `bpVerifySettleRequest` | pp. 31-32, table 12; table 11 | Atomic local lifecycle representation; `0`/`43`/`45`/`48` only from direct retry wording. |
| `bpCumulativeDynamicPayRequest` | pp. 10, 30-31; table 10 | Safe normal-path parser, bigint distribution-total validation, documented `0,RefId`, and local opaque RefId. |
| Semantic scenarios, transport faults, dashboard | no provider assertion | Bounded `SIMULATOR_SCENARIO`/`SIMULATOR_INTERNAL` tooling from Goals 9-11. |

## Remaining operation inventory and evidence

`Required`/`optional` mean only what source table/note states. Missing request transport, field requiredness, correlation, state, or result detail is `UNSPECIFIED`.

| Exact v1.39 capability | Pages | Purpose and workflow position | Request transport and fields | Response / operation-specific results | State, retry, timing, security, unspecified points |
| --- | --- | --- | --- | --- | --- |
| `bpChargePayRequest` | pp. 9, 12, 14-18; table 1 | Mobile-charge payment request. Source calls it similar to Pay; then RefId goes to payment page. | SOAP/XML over HTTP(S) at source-global level. Table-1 fields: `terminalId` long, `userName` string, `userPassword` string, `orderId` long, `amount` long, `localDate` string, `localTime` string, `additionalData` string, `callBackUrl` string, `payerId` string; optional `mobileNo`, `encPan`, `panHiddenMode`, `cartItem`, `enc`. For charge, `additionalData` is `Charge Type , Charge Data`: type `1` TopUp plus `MobileNumber`, or type `2` Voucher plus `Operator Code , Voucher Serial`; operators 1/2/6/7 listed. | Two-part string illustrated as `0,RefId`; `0` yields POST RefId; nonzero directs merchant to obtain a new RefId and call again. No nonzero code is tied specifically to Charge. | `orderId` unique requirement follows shared request note. Later Verify/Settle/etc. only described as similar at pp. 9-10 (`DERIVED` compatibility with implemented lifecycle). Charge fulfilment, voucher/number validation, charge-specific callback, exact `additionalData` whitespace/lexical grammar, credentials/authentication, nonzero mappings and final charge state: `UNSPECIFIED`. `MobileNumber`/voucher data must not become real personal/service data intake. |
| `bpRefundRequest` | pp. 10, 13, 24-25; table 6 | Internet/POS purchase refund, whole or partial, after purchase settled and `bpSettleRequest` called. | SOAP/XML only at source-global level. Fields: `terminalId` long, `userName` string, `userPassword` string, `orderId` long, `saleOrderId` long, `saleReferenceId` long, `refundAmount` long. No table marks optional fields. | Two-part string `ResCode, refund tracking number`; source says second part has value when first part is `0`. `0` is specifically initial refund-request acceptance, **not** final card return. | Repeated refunds allowed while sum of requested refunds does not exceed original purchase amount; each refund `orderId` unique. Timeout/nonzero requires separately documented refund-inquiry services before retry; no repeat while result/pending. Refund inquiry contract is absent from this PDF. `12`, `19`, `42` have refund explanations in global table but operation-to-condition mapping remains incomplete except wording shown there; no invented mapping. Final refund transition, inquiry operation/name/schema, refund reference format, auth, timing, failure/partial mutation: `UNSPECIFIED`. |
| `bpRefundRequestV2` | pp. 10, 13, 25-27; table 7 | Same refund, with alternate destination card where original-card transfer is unavailable. | Same table-6 fields plus optional `destinationPAN` string and optional `mobileNo` string. Source says alternate-card refund needs **both** `DestinationPAN` and `MobileNo`. | Same behavior as `bpRefundRequest`, including `0` initial acceptance only. | Same cumulative amount, unique request number, inquiry-before-retry and pending restrictions. It additionally says provider checks original/new card and mobile belong to one person. PAN/mobile validation, encryption, consent, final outcome and inquiry contract: `UNSPECIFIED`; real PAN/mobile intake is prohibited by simulator security policy. |
| `bpRefundToPANRequest` | pp. 27-28; table 8 | Refund a stated amount to a specified card, or to original card retrieved through a purchase reference; amount debits merchant credit. | SOAP/XML only at source-global level. Exact table casing differs: `terminalId` long, `User` string, `Password` string, `PAN` long, `SaleReferenceId` Long, `Amount` long, `orderId` long, optional `mobileNo` string. `PAN` and `SaleReferenceId` are optional individually but exactly one must be present each call. | Source says output is `ResponseCode,ReferenceNumber`; earlier example gives `0,183800538958`. | `orderId` unique per request. `mobileNo` optionally supports card/mobile matching. Full/partial amount constraints, source-purchase settlement requirement, retry/pending behavior, result-code mapping, reference format, final state, and merchant-credit model: `UNSPECIFIED`. Raw PAN is incompatible with simulator security policy. |
| `bpDynamicPayRequest` | pp. 9-10, 13, 28-29; table 9 | Type-two payment with dynamically selected payout-account identifier. Source says later confirmation, settlement, reversal and inquiry follow Pay flow. | SOAP/XML only at source-global level. Table-9: table-1 required fields plus `subServiceId` long; optional `mobileNo`, `encPan`, `panHiddenMode`, `cartItem`, `enc`. `additionalData` maximum 1000 characters. | Illustrated `0,RefId`; source says `0` causes RefId POST to server. It says nonzero result directs a new RefId/new call, but names no dynamic-operation-specific nonzero code. | Dynamic request `orderId` unique; RefId case-sensitive. `subServiceId` hides a payer identifier at payment page only for merchants preconfigured for it; otherwise cardholder must enter valid payer identifier. Provider provisioning/validation, exact failure codes, RefId format, callback/automatic timing operation differences, wire schema, credential auth: `UNSPECIFIED`. Required normal path contains no card/PAN/mobile data. |
| `bpCumulativeDynamicPayRequest` | pp. 10, 13, 30-31; table 10 | Cumulative type-two payment: one total payment dynamically distributes funds among multiple payout accounts. | SOAP/XML only at source-global level. Fields are table-1 required fields; `additionalData` is up to 10 `account-id,amount,payer-id` triples separated by commas and triples separated by semicolons; optional `mobileNo`, `encPan`, `panHiddenMode`, `cartItem`, `enc`. No `subServiceId` field. | Illustrated `0,RefId`; `0` POSTs RefId. Text mistakenly cites table 3 for response; page context/table 11 is insufficient to attach nonzero outcomes. | Request `orderId` unique; RefId case-sensitive. Source says total payment equals sum of distribution amounts. Exact parser rules (empty payer id illustrated but no full grammar), account authorization, rounding/negative/zero rules, later-operation correlation, failure codes, provisioning and state: `UNSPECIFIED`. Payer identifiers may be personal data; do not store/display them. |

## Remaining specialized capabilities, not standalone SOAP operations

| Capability | Pages | Evidence and classification | Implementability / omitted facts |
| --- | --- | --- | --- |
| StartPay `MobileNo` profile identifier | p. 18 | `DOCUMENTED / PROTOCOL`: may be posted with RefId; gateway may store cards/expiry by the 12-digit profile identifier. | `BLOCKED`: personal identifier and card-saving behavior; storage, consent, retention, and provider UI are outside safe local simulator. |
| StartPay encrypted PAN list / `HiddenMode` | pp. 16-17, 19 | `DOCUMENTED / PROTOCOL`: Pay optional `encPan`/`panHiddenMode`; Redirect example uses `EncPan`/`HiddenMode`, DES key material and display effect. Source casing is inconsistent. | `BLOCKED`: accepting or decrypting PAN is prohibited. Encryption compatibility, casing mapping and list grammar remain `UNSPECIFIED`. |
| `enc` Mana/strong-authentication fields | pp. 16-17 | `DOCUMENTED / PROTOCOL`: encrypted national ID may be obligatory for brokerage/Mana or optional strong auth; `20` is expressly tied to missing auth parameters for brokerage. | `BLOCKED`: encryption/key material and identity data are unsafe here; broker configuration, applicability, validation and all other results are `UNSPECIFIED`. |
| `merchantName` / `merchantAddress` Redirect display | p. 20 | `DOCUMENTED / PROTOCOL`: optional RefId-posted display values. | `PARTIAL`: examples only; types/limits/callback/response effects `UNSPECIFIED`. No need for core lifecycle. |
| `GamBonds` Redirect | p. 20 | `DOCUMENTED / PROTOCOL`: source says send value `1` with RefId for Gam-bond purchase, but prose contains a spelling inconsistency. | `BLOCKED`: product flow, fields, lifecycle, results and exact wire spelling are insufficient. |
| `SettleTime` Redirect and automatic settlement | p. 20 | `DOCUMENTED / PROTOCOL`: any string `SettleTime` changes automatic settlement from 180 to 360 minutes; successful un-reversed/unsettled default transaction settles on merchant behalf after 180 minutes. | `PARTIAL`: interaction with manual Settle, Verify/VerifySettle, reversal and provider completion is not specified. No scheduler/timer hidden transition added. |
| Iranian-goods credit purchase `additionalData` / callback detail | pp. 14, 17, 33-34 | `DOCUMENTED / PROTOCOL`: source supplies an `additionalData` structure and special callback-detail grammar. | `OUT_OF_SCOPE_FOR_CORE_SIMULATOR`: different payment page/product and callback subprotocol. Full eligibility/provider outcome and safe test-fixture policy would need dedicated goal. |
| Refund-transaction inquiry services | pp. 25-27 | `MENTIONED / INSUFFICIENTLY SPECIFIED`: required before timeout/nonzero refund retry and for final refund status, but declared documented in another document not supplied. | `BLOCKED`: exact operation names, fields, output, pending semantics and final states absent. |
| Registered IP, merchant credentials, domains and ports | pp. 12, 16-18, 35-37 | `DOCUMENTED / PROTOCOL`: merchant provisioning, registered-domain/IP conditions, and related global result descriptions. | `OUT_OF_SCOPE_FOR_CORE_SIMULATOR`: provisioned network/merchant-auth system not specified enough for safe deterministic local provider emulation; no real credentials or network policy implementation. |

## Implementability assessment

| Capability | Assessment | Exact reason |
| --- | --- | --- |
| `bpChargePayRequest` | `PARTIAL` | Shared request/refId flow is documented, but required charge payload includes real mobile/voucher service data and charge completion semantics/results are not supplied. |
| `bpRefundRequest` | `PARTIAL` | Request, prerequisite, partial-amount limit and initial acceptance response exist, but final completion depends on missing refund-inquiry document. A faithful end-to-end refund lifecycle cannot be made. |
| `bpRefundRequestV2` | `BLOCKED` | Same missing refund inquiry plus alternate PAN/mobile identity matching. |
| `bpRefundToPANRequest` | `BLOCKED` | Raw PAN is a principal input; its final/refund lifecycle and amount/precondition rules are incomplete. |
| `bpDynamicPayRequest` | `READY` | Exact operation name, fields/types, unique order rule, `0,RefId` success, RefId POST and Pay-like following workflow are documented. A safe normal path can reject optional sensitive fields and does not require extra durable account/payment data. |
| `bpCumulativeDynamicPayRequest` | `SAFE_PARTIAL` | Goal 13 re-check found direct delimiters, up-to-ten entry maximum, illustrated empty payer-id/terminal semicolon, total-sum rule, normal response, and Pay-like later workflow. Bounded canonical parsing is useful without provider payout or lexical-completeness claims. |
| StartPay `SettleTime` | `PARTIAL` | Timing fact exists, but provider settlement/reversal interaction is incomplete; Goal 12 must not create timer-driven behavior. |
| StartPay PAN/profile/auth features | `BLOCKED` | They require card, identity, mobile, encryption/key, or credential handling prohibited by project security rules. |
| Iranian-goods credit product | `OUT_OF_SCOPE_FOR_CORE_SIMULATOR` | Product-specific request/callback contract belongs in a separate specialized flow. |
| Refund inquiry services | `BLOCKED` | Sole authority does not contain their contract. |

## Goal 12 selection

Selected smallest coherent slice: **safe normal-path `bpDynamicPayRequest`**.

It is `READY` from direct pages 28-29/table 9 plus pages 9-10. It reuses existing simulator Sale/callback plumbing as `DERIVED` local compatibility, without inventing a refund, timers, provider provisioning or payout execution. Source does not require durable `subServiceId` state for later correlation; it is validated as input then discarded. Existing transaction aggregate remains a Sale aggregate; operation identity is preserved only as a safe diagnostic field.

All PAN, encrypted PAN, national-ID encryption, phone/profile data, PIN, CVV2, OTP, merchant credentials and keys remain unaccepted/unpersisted/unrendered for this slice. `userName`/`userPassword` stay structural fake input and are discarded.

## Deferred questions

- Are Pay and Dynamic Pay order-number uniqueness scopes shared or operation-specific? Source establishes uniqueness for each named payment request, not cross-operation collision. Local repository rejects a shared terminal/order pair as `SIMULATOR_INTERNAL` ambiguity prevention, never as provider behavior.
- Does dynamic flow use exactly Pay callback/StartPay semantics or only a conceptual similar workflow? Pages 9-10 say following stages are similar, but do not repeat callback field table.
- Which global table-11 codes apply to Dynamic Pay failures? `UNSPECIFIED`.
- What provider rules validate/provision `subServiceId` and payer identifiers? `UNSPECIFIED`.
- How should valid cumulative `additionalData` handle lexical edge cases? `UNSPECIFIED`.
- What refund inquiry API resolves initial acceptance/pending/final state? Absent from supplied PDF.

## Focused follow-up: Pay/Dynamic Pay uniqueness and lifecycle

### Source findings

- Printed page 11 defines `orderId` as request number/identifier, sent with every method/request invocation. Closest faithful translation: it “must be unique for payment requests (`bpPayRequest`)”; each merchant-to-gateway request needs a special identifying number, namely `orderId`. This does not name `terminalId`, merchant-wide, operation-wide, or Pay/Dynamic cross-operation scope.
- Printed page 16 shared Pay/Charge note: “in every merchant request, the submitted payment request number must be unique; otherwise this method returns an error.” It still does not name a collision scope or tie global table-11 `41` to this condition.
- Printed page 29/table 9 defines Dynamic Pay `orderId` as payment-request number. Printed page 29 note: “in every merchant request, the submitted Type Two payment request number must be unique; otherwise this method returns an error.” It does not say whether a Pay request and Dynamic Pay request may share it.

### Compared models

| Model | Classification | Reason |
| --- | --- | --- |
| A. `terminalId + orderId` across Pay/Dynamic Pay | `SIMULATOR_INTERNAL` | Source does not define terminal scope or cross-operation collision, but this conservative local key prevents ambiguous payment identity. |
| B. `terminalId + paymentOperation + orderId` | `SIMULATOR_INTERNAL` | Source has named per-operation uniqueness notes, but does not explicitly authorize same-terminal cross-operation reuse. |
| C. Another source-defined scope | `UNSUPPORTED` | v1.39 supplies no merchant-, service-family-, or transaction-family-scoped uniqueness rule. |

Chosen local invariant: **one `orderId` may identify only one Pay-family request per terminal, across Pay and Dynamic Pay.** This is `SIMULATOR_INTERNAL`, not Behpardakht behavior. Both `Pay(terminal 1, order 100) -> DynamicPay(terminal 1, order 100)` and reverse order now leave one transaction and return operation-local SOAP Faults. A different terminal remains allowed. No response is provider `41`.

Pre-Goal-12 repository key was already `terminalId + orderId` for Pay. Goal 12 briefly weakened it by adding `paymentOperation`; this follow-up restores/extends previous conservative identity rule to Dynamic Pay. `getByTerminalIdAndOrderId` is again unambiguous. RefId, Sale correlation, dashboard transaction ID, scenario assignment, and transport-fault assignment remain transaction-ID/RefId/correlation based and need no redesign.

### Dynamic Pay continuation evidence

Printed pages 9-10 say Dynamic Pay is functionally similar to `bpPayRequest` except for payout-account identifier, then state: “continuation of work for purchase confirmation, deposit, return, and inquiry is similar to the process described for `bpPayRequest`.” Therefore Verify, Settle, Reversal, and Inquiry compatibility is `DOCUMENTED / PROTOCOL` at that high level. Printed page 28 says success posts RefId to server; direct Dynamic Pay evidence does **not** name StartPay URL, Sale callback fields, or `bpVerifySettleRequest`. Local fake StartPay/Sale/callback reuse is `DERIVED`. VerifySettle applicability is `UNSPECIFIED`; current shared local handler accepts it as `SIMULATOR_INTERNAL` compatibility, not provider behavior.

### Dynamic Pay sensitive-field audit

| Field | v1.39 table 9 | Local parser | Stored/logged/events/dashboard |
| --- | --- | --- | --- |
| `mobileNo` | optional string | rejected | absent |
| `encPan` | optional string | rejected | absent |
| `enc` | optional string | rejected | absent |
| `subServiceId` | required long | accepted bigint | discarded; absent |

Rejecting optional sensitive fields preserves required normal-path shape: all table-9 required fields, including `subServiceId`, remain accepted. `panHiddenMode` and `cartItem` remain accepted then discarded.

## Goal 13 decision

### Local official-source inventory

Inspected official source: `Mellat PGW_Tech Doc_ver 1.39_Fa.pdf`, stored at `../_Doc/` beside this repository (the identical `Downloads/` copy has SHA-256 `aed59fc9370bcd2fafa42ee5e80a4083020842532ec207129e9903d3847e3e3e`). PDF metadata title is *User Guide: Internet Payment Gateway Functions and Methods*, Behpardakht Mellat; headers identify version 1.39 / Azar 1404; 38 pages. It is official/source-authoritative because it is the supplied document named by project guardrails and identifies itself as Behpardakht Mellat technical guidance.

No other official Behpardakht PDF is present in `../_Doc/` or repository/reference scope. In particular, the separate refund-inquiry document named on printed pages 25-27 is absent. No web source was used.

### Candidate re-audit

| Candidate | Goal 13 classification | Direct evidence and decision |
| --- | --- | --- |
| `bpRefundRequest` | `BLOCKED` | Printed pp. 24-25/table 6: required `terminalId`, `userName`, `userPassword`, unique refund `orderId`, `saleOrderId`, `saleReferenceId`, `refundAmount` (all numeric identifiers/amounts are `long` except strings). Full/partial refund permitted only after purchase settled and `bpSettleRequest`; sum cannot exceed original amount. Response is `ResCode,tracking-number`; `0` means *initial acceptance*, not returned money. Timeout/nonzero and `pending` explicitly require refund-inquiry services before retry/final-state decision. Those services' operation, request, result, timing, correlation and state contract are absent. No accepted/pending slice is implemented: tracking/reference semantics and safe final resolution would still be unusable and misleading. |
| `bpChargePayRequest` | `DEFER` | Printed pp. 14-18/table 1: same request fields/types as Pay, normal `0,RefId`, then RefId POST. Printed p. 18 mandates `additionalData = Charge Type, Charge Data`: type `1` direct TopUp with `MobileNumber`, or type `2` Voucher with `Operator Code,Voucher Serial`; codes 1/2/6/7 are listed. Provider charge fulfilment, mobile/voucher validation, charge-specific results, retries and final state are unspecified. Direct service data intake is not selected. |
| `bpCumulativeDynamicPayRequest` | `SAFE_PARTIAL`, selected | Printed p. 10 says Pay-like confirmation, settlement, reversal and inquiry. Printed pp. 30-31/table 10 establishes `terminalId` long, `userName` string, `userPassword` string, `orderId` long, `amount` long, `localDate` string, `localTime` string, `additionalData` string, `callBackUrl` string; optional `mobileNo`, `encPan`, `panHiddenMode`, `cartItem`, `enc`. `additionalData` has up to ten account-id/amount/payer-id triples, comma-delimited within and semicolon-delimited between triples; example includes empty payer-id and terminal semicolon; total equals distribution sum. Normal `0,RefId`, RefId POST, unique request number and case-sensitive RefId are explicit. Account authorization/provisioning, full lexical grammar, negative/zero policy, nonzero results, retry/timing and payout execution are unspecified. |
| StartPay `SettleTime` | `DEFER` | Printed p. 20: POSTing RefId plus any string `SettleTime` changes automatic settlement from default 180 minutes to 360. Default successful transactions without a Reversal or Settle request get merchant-behalf settlement after 180 minutes. Source does not define interaction with explicit `bpSettleRequest`, `bpVerifySettleRequest`, Reversal's three-hour/end-of-day statements, completed deposit, or retry. No hidden/background timer or clock-triggered state transition is added. |

`bpRefundRequestV2` remains `BLOCKED`: pp. 25-27/table 7 adds optional `destinationPAN` and `mobileNo`, both required for alternate-card refund, with card/mobile ownership checking plus the missing inquiry dependency. `bpRefundToPANRequest` remains `BLOCKED`: pp. 27-28/table 8 accepts raw PAN or `SaleReferenceId` (exactly one), and may accept mobile information. Both violate the simulator's credential/card boundary and lack final lifecycle evidence.

### Selected slice and local boundary

`bpCumulativeDynamicPayRequest` is the only Goal 13 implementation. Its table-10 normal path parses one through ten triples, accepts the illustrated empty payer-id and one terminal semicolon, parses ASCII decimal distribution amounts as bigint, and requires their sum to equal request `amount`. Invalid local grammar causes a local SOAP validation Fault with zero transaction creation; this does not assert provider rejection. Valid input creates existing Pay-family state with `paymentOperation: "CUMULATIVE_DYNAMIC_PAY"`, emits existing `TRANSACTION_CREATED` and `REF_ID_ASSIGNED` events only, and returns normal `0,RefId`.

`DOCUMENTED / PROTOCOL`: table-10 shape, delimiters, count, sum constraint, success response, RefId POST, request uniqueness statement, and high-level Pay-like workflow. `DERIVED`: reuse of local StartPay/Sale/callback/later-operation plumbing. `SIMULATOR_INTERNAL`: canonical parser, local Faults, terminal-wide Pay-family uniqueness, opaque RefId, domain record and dashboard label. `SIMULATOR_SCENARIO`: none added. `UNSPECIFIED`: WSDL/wire details, credentials, account authorization, provider result mappings, true payout/settlement, timing, and unlisted lexical cases.

All `mobileNo`, `encPan`, and `enc` inputs reject locally. PAN, destination PAN, mobile data, PIN, CVV2, OTP, credentials, encryption/key material, `additionalData`, account identifiers and payer identifiers are never stored, logged, rendered, added to events, or returned by dashboard DTOs. `userName`/`userPassword`, `panHiddenMode`, and `cartItem` are structural inputs then discarded.

### Goal 14 recommendation

Do not add a payment capability until a source-grounded decision is possible. Highest-value prerequisite is obtaining the official refund-transaction inquiry specification referenced by v1.39; only then re-audit a bounded Refund accepted/pending/final-state model. Keep Charge, SettleTime, PAN/profile/authentication and specialized credit-product work deferred.
