# Architecture

## Status

Goal 3 adds `src/server/soap`, `src/server/protocol`, and local `POST /api/soap`. `SIMULATOR_INTERNAL` choices below must never be presented as Behpardakht protocol.

## Boundaries

```text
Client
  -> local SOAP/HTTP boundary (`/api/soap`)
  -> XML parser / bpPayRequest adapter
  -> bpPayRequest application handler
  -> transaction state machine
  -> replaceable in-memory transaction repository

Payment browser
  -> fake payment page
  -> controlled simulated result
  -> allowlisted callback dispatcher
  -> client callback

Separate: scenario engine, developer dashboard
```

Future server modules: `src/server/protocol`, `src/server/soap`, `src/server/transactions`, `src/server/callbacks`, `src/server/scenarios`, and `src/server/security`.

## Goal 3 SOAP boundary (`SIMULATOR_INTERNAL` unless stated otherwise)

`src/app/api/soap/route.ts` owns only local HTTP entry. `src/server/soap` bounds body intake, parses XML, applies local SOAP compatibility rules, serializes local SOAP responses/faults, and dispatches only `bpPayRequest`. `src/server/protocol/pay-request.ts` performs Pay application work without HTTP objects.

SOAP requests use a 64 KiB local body cap. `saxes` is event-driven XML parsing; its installed source confirms it does not fetch a DTD or define extra DTD entities unless caller explicitly does so. This adapter rejects every DTD, accepts no remote resource, uses bounded depth/node counts, and does not log input values. Exact limits and SOAP representation are not Behpardakht facts.

`BpPayRequestHandler` validates source-backed field shape at adapter, creates Goal 2 transaction, assigns one unique opaque local RefId, saves its event-bearing immutable snapshot, then formats success as documented `0,RefId`. It retains only existing Goal 2 transaction correlation data: `terminalId`, `orderId`, `amount`, `callBackUrl`, and local `refId`. It never persists `userPassword`, `userName`, card-related optional values, or raw XML.

## Transaction domain (`SIMULATOR_INTERNAL`)

`src/server/transactions` is a small immutable aggregate and no endpoint. It stores protocol-correlating fields using documented casing (`terminalId`, `orderId`, `amount`, `callBackUrl`, `refId`, `saleOrderId`, `saleReferenceId`) plus simulator transaction/event IDs.

Four constrained axes model lifecycle facts: Sale (`PENDING`, `SUCCEEDED`, `NON_SUCCESS`), verification (`NOT_ATTEMPTED`, `ATTEMPTED`, `VERIFIED`), settlement (`NOT_REQUESTED`, `REQUESTED`), and reversal (`NOT_REQUESTED`, `REQUESTED`). Derived `lifecycleState` gives diagnostics a single current label. `NON_SUCCESS` deliberately is not final failure: v1.39 documents a Verify path after nonzero callback `ResCode`. Axes are necessary because an unresolved Verify attempt is materially different from a confirmed Verify, while Inquiry does not itself create a known provider state.

Every accepted transition returns a new immutable snapshot and appends a typed event. Unresolved verification permits repeated `VERIFY_ATTEMPTED` events, matching documented Verify retry direction; a confirmed, settled, or reversal-requested transaction rejects another attempt. Domain errors are simulator-internal and never Behpardakht response codes. No provider response mapping, timer execution, automatic settlement, automatic reversal, callback dispatch, or SOAP work exists.

The replaceable `TransactionRepository` has an in-memory implementation. It enforces documented Pay `orderId` uniqueness within `terminalId` context and supports lookup by simulator ID, Pay correlation, `refId`, and later-operation correlation (`terminalId`, `saleOrderId`, `saleReferenceId`). `bigint` preserves `long` values internally; it is not a wire-serialization decision.

`Clock` has `SystemClock` and deterministic `ManualClock`. It records timestamps only; no scheduled job or real timer is implemented.

## Non-negotiable security architecture

No real PAN, PIN, CVV2, OTP, banking credential, or secret belongs in UI, logs, storage, fixtures, or source control. Callback destinations need explicit allowlisting, URL parsing/validation, SSRF defense, bounded time/response size, and no blind redirect following. SOAP/XML intake needs size bounds, input validation, safe parsing, and DTD/external-entity/entity-expansion rejection. Diagnostics must be safely rendered. No generic arbitrary HTTP-request feature.

## Deferred decisions

`SIMULATOR_INTERNAL`: database/persistence, authentication, dashboard, scenario engine, payment-page/callback implementation are deferred. Exact provider WSDL/envelope/serialization choices remain unspecified. Goal 3 local compatibility choices are isolated in `src/server/soap`; see `docs/protocol/SOAP_COMPATIBILITY.md`.
