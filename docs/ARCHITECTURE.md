# Architecture

## Status

Goal 9 adds separate deterministic `SIMULATOR_SCENARIO` engine. `SIMULATOR_INTERNAL` and scenario choices below must never be presented as Behpardakht protocol.

## Boundaries

```text
Client
  -> local SOAP/HTTP boundary (`/api/soap`)
  -> XML parser / Pay, Verify, Settle, VerifySettle, Inquiry, or Reversal adapter
  -> operation application handler
  -> transaction state machine
  -> replaceable in-memory transaction repository

Payment browser
  -> local StartPay POST boundary
  -> fake payment page
  -> controlled simulated result
  -> transaction state machine
  -> allowlisted callback dispatcher
  -> merchant callback

Local scenario control (`/local/api/scenarios`)
  -> `ScenarioEngine` process-memory registry
  -> transaction-scoped semantic condition
  -> protocol handler after documented correlation

Separate: developer dashboard
```

Server modules: `src/server/protocol`, `src/server/soap`, `src/server/transactions`, `src/server/callbacks`, `src/server/scenarios`; `src/server/security` remains future work.

## Goal 3 SOAP boundary (`SIMULATOR_INTERNAL` unless stated otherwise)

`src/app/api/soap/route.ts` owns only local HTTP entry. `src/server/soap` bounds body intake, parses XML, applies local SOAP compatibility rules, serializes local SOAP responses/faults, and dispatches only `bpPayRequest`, `bpVerifyRequest`, `bpSettleRequest`, `bpVerifySettleRequest`, `bpInquiryRequest`, and `bpReversalRequest`. `src/server/protocol` performs operation application work without HTTP objects.

SOAP requests use a 64 KiB local body cap. `saxes` is event-driven XML parsing; its installed source confirms it does not fetch a DTD or define extra DTD entities unless caller explicitly does so. This adapter rejects every DTD, accepts no remote resource, uses bounded depth/node counts, and does not log input values. Exact limits and SOAP representation are not Behpardakht facts.

`BpPayRequestHandler` validates source-backed field shape at adapter, creates Goal 2 transaction, assigns one unique opaque local RefId, saves its event-bearing immutable snapshot, then formats success as documented `0,RefId`. It retains only existing Goal 2 transaction correlation data: `terminalId`, `orderId`, `amount`, `callBackUrl`, and local `refId`. It never persists `userPassword`, `userName`, card-related optional values, or raw XML.

`BpVerifyRequestHandler` uses table-2 `terminalId`, `saleOrderId`, `saleReferenceId` as complete Sale correlation. Verify `orderId` is only source-defined verification-request number: non-unique, permitted equal `saleOrderId`. After documented boundary it consults injected `ScenarioPolicy`. `NORMAL` preserves immutable attempt/confirmation and source-backed `0`/`43`; `VERIFY_UNRESOLVED` saves only attempt then emits local `SimulatorScenario.VerifyUnresolved` Fault with no provider code. It neither settles nor dispatches callback. Unknown/mismatching correlation and non-modeled states are local faults, not provider codes.

`BpSettleRequestHandler` uses table-3 `terminalId`, `saleOrderId`, and `saleReferenceId` as complete correlation. Settle `orderId` is non-unique settlement-request number, permitted to equal `saleOrderId`, never lookup key. Correlated verified transaction records `SETTLEMENT_REQUESTED` (`via: "SETTLE"`) and source-backed `0`, receipt of settlement request. Sale/Verify remain unchanged; no callback, banking action, or deposit claim. v1.39 lacks Settle-specific nonzero mapping for retry/correlation/pre-Verify outcomes, so rejected states fault without mutation.

`BpVerifySettleRequestHandler` uses table-12 `terminalId`, `saleOrderId`, and `saleReferenceId` as complete correlation. VerifySettle `orderId` is non-unique, may equal `saleOrderId`, and is never lookup key. Source directly names its `0`/previously-verified/settled/reversed results; table 11 maps named states to `0`/`43`/`45`/`48`. Successful combined request makes one immutable snapshot with Verify `VERIFIED`, settlement `REQUESTED`, and event `SETTLEMENT_REQUESTED` (`via: "VERIFY_SETTLE"`). It does not record separate merchant Verify/Settle calls, dispatch callback, perform banking, or claim deposit.

`BpInquiryRequestHandler` uses table-4 complete correlation. Inquiry `orderId` is non-unique and may equal `saleOrderId`; it is never lookup key. Source purpose does not make internal `ATTEMPTED` provider eligibility. Source names response-code string but no operation-specific result, so fully correlated calls fault locally with no event, status object, or lifecycle mutation.

`BpReversalRequestHandler` uses table-5 complete correlation and non-unique/non-lookup `orderId`. It requires local prior Verify invocation; settlement-requested rejection is `DERIVED` conservative policy, not explicit inverse provider rule. It does not treat `ATTEMPTED`/`VERIFIED` distinction as provider eligibility. Source names response-code string but no operation-specific result, so calls fault locally without request/completion mutation. `REVERSED` remains internal known-reversed representation; Verify returns source-backed `48` for it without mutation.

## Goal 4 browser and callback boundaries (`SIMULATOR_INTERNAL`)

`src/server/start-pay` accepts bounded `application/x-www-form-urlencoded` data containing exactly `RefId`; unknown or unsupported forms fail locally. `src/app/local/start-pay/route.ts` looks up that stored RefId and uses a local 303 handoff to `src/app/local/payment/[refId]/page.tsx`. Redirect form/response behavior is not asserted as provider protocol. The page exposes only success and one non-success/cancellation choice; action routes use stored transaction values only and reject duplicate actions.

`src/server/payment` records Sale through domain transitions, generates injectable decimal `bigint` SaleReferenceIds, then dispatches. `src/server/callbacks` builds exact documented field names and POSTs `application/x-www-form-urlencoded` as a local encoding decision. It validates exact configured origins, allows only HTTP(S), rejects credentials, uses `redirect: "error"`, a three-second bound, and a 16 KiB bounded response drain. Callback status is typed append-only event history, not Sale state.

`src/server/local-simulator.ts` is the local composition root. A process-global in-memory singleton is required so separately evaluated App Router route bundles share transaction state. It is still only process memory: no database, queue, or external infrastructure exists.

## Goal 9 scenarios (`SIMULATOR_SCENARIO`)

`src/server/scenarios` is narrow registry/policy, separate from SOAP, transaction repository, transaction protocol fields. `/local/api/scenarios` accepts only exact JSON shapes keyed by pre-existing opaque RefId. `VERIFY_UNRESOLVED` configuration only; `KNOWN_REVERSED` atomically saves existing domain `REVERSED` result with auditable `SCENARIO_STATE_FORCED`, then stores assignment. Clear removes registry configuration only.

Aggregate does not select scenarios. It represents resulting `REVERSED` state and explicit simulator-origin event. Existing protocol handlers alone translate known `REVERSED` to documented Verify/VerifySettle `48`. No scenario parses XML, serializes SOAP, uses Behpardakht field, injects provider code, changes callback security, persists data, runs timers.

## Transaction domain (`SIMULATOR_INTERNAL`)

`src/server/transactions` is a small immutable aggregate and no endpoint. It stores protocol-correlating fields using documented casing (`terminalId`, `orderId`, `amount`, `callBackUrl`, `refId`, `saleOrderId`, `saleReferenceId`) plus simulator transaction/event IDs.

Four constrained axes model lifecycle facts: Sale (`PENDING`, `SUCCEEDED`, `NON_SUCCESS`), verification (`NOT_ATTEMPTED`, `ATTEMPTED`, `VERIFIED`), settlement (`NOT_REQUESTED`, `REQUESTED`), and reversal (`NOT_REVERSED`, `REVERSED`). Derived `lifecycleState` gives diagnostics a single current label. `NON_SUCCESS` deliberately is not final failure: v1.39 documents a Verify path after nonzero callback `ResCode`. Axes are necessary because an unresolved Verify attempt is materially different from a confirmed Verify, while Inquiry does not itself create a known provider state.

Every accepted transition returns a new immutable snapshot and appends a typed event. Goal 4 adds `SALE_SUCCEEDED`/`SALE_NON_SUCCESS` correlation values plus callback attempted/succeeded/failed diagnostics. Callback transport failure never changes Sale. Unresolved verification permits repeated `VERIFY_ATTEMPTED` events, matching documented Verify retry direction; a confirmed, settled, or reversed transaction rejects another attempt. Inquiry/Reversal SOAP faults add no events. `REVERSED` is internal known-state representation, not Reversal SOAP success. Domain errors are simulator-internal and never Behpardakht response codes. No timer execution, automatic settlement, or automatic reversal exists.

Goal 8 combined success changes verification and settlement in one snapshot, with one `SETTLEMENT_REQUESTED` event marked `via: "VERIFY_SETTLE"`; this is simulator-internal history and does not claim separate merchant calls.

Goal 9 adds `SCENARIO_STATE_FORCED { scenario: "KNOWN_REVERSED" }`. This is explicitly `SIMULATOR_SCENARIO`, unlike `REVERSAL_COMPLETED`, never claims `bpReversalRequest` happened.

The replaceable `TransactionRepository` has an in-memory implementation. It enforces documented Pay `orderId` uniqueness within `terminalId` context and supports lookup by simulator ID, Pay correlation, `refId`, and later-operation correlation (`terminalId`, `saleOrderId`, `saleReferenceId`). `bigint` preserves `long` values internally; it is not a wire-serialization decision.

`Clock` has `SystemClock` and deterministic `ManualClock`. It records timestamps only; no scheduled job or real timer is implemented.

## Non-negotiable security architecture

No real PAN, PIN, CVV2, OTP, banking credential, or secret belongs in UI, logs, storage, fixtures, or source control. Callback destinations need explicit allowlisting, URL parsing/validation, SSRF defense, bounded time/response size, and no blind redirect following. SOAP/XML intake needs size bounds, input validation, safe parsing, and DTD/external-entity/entity-expansion rejection. Diagnostics must be safely rendered. No generic arbitrary HTTP-request feature.

## Deferred decisions

`SIMULATOR_INTERNAL`: database/persistence, authentication, automatic/retry callback policy, payment-page production behavior remain deferred. Goal 10 transport faults and Goal 11 dashboard remain deferred. Exact provider WSDL/envelope/serialization choices remain unspecified. Goal 3 local compatibility choices are isolated in `src/server/soap`; see `docs/protocol/SOAP_COMPATIBILITY.md`.
