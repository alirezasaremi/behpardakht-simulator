# v0.1 release readiness

## Scope and source authority

Goal 14 audits only currently supported local simulator core. It does not add Refund, Charge, SettleTime, payment credentials, provider WSDL, persistence, or deployment work.

Only authority for Behpardakht behavior is supplied *Mellat PGW Technical Document v1.39* (Azar 1404). It is reviewed through approved project context and is not tracked or redistributed by this public repository. Page references below use PDF printed page numbers. Existing protocol notes are navigation aids, not authority.

Classification:

- `PROTOCOL`: direct v1.39 fact.
- `DERIVED`: narrow local reuse of a documented high-level relationship.
- `SIMULATOR_INTERNAL`: local implementation/compatibility choice.
- `SIMULATOR_SCENARIO`: bounded developer test behavior.
- `UNSPECIFIED`: source does not establish behavior; simulator must not infer it.

## Supported inventory

| Capability | Boundary / implementation | Request and response | State/event and repeat behavior | Scenario / transport / dashboard | Classification |
| --- | --- | --- | --- | --- | --- |
| `bpPayRequest` | `src/app/api/soap/route.ts`, `src/server/soap/pay-request.ts`, `src/server/protocol/pay-request.ts` | Table-1 required normal fields; local accepts safe `panHiddenMode`/`cartItem`, rejects `mobileNo`/`encPan`/`enc`; `0,RefId` | Creates Pay-family transaction, assigns opaque case-preserved RefId; terminal-wide duplicate `{terminalId, orderId}` faults | No scenario/fault target before RefId; `PAY` safe dashboard label | `PROTOCOL` fields/normal result; rest internal |
| `bpDynamicPayRequest` | `src/server/soap/dynamic-pay-request.ts`, `src/server/protocol/dynamic-pay-request.ts` | Table-9 required normal fields plus bigint `subServiceId`; `0,RefId` | Same safe local request creation; `subServiceId` discarded; duplicate faults | Existing Sale/callback/later handling available; dashboard label `DYNAMIC_PAY` | `PROTOCOL` normal request/result; later reuse `DERIVED` |
| `bpCumulativeDynamicPayRequest` | `src/server/soap/cumulative-dynamic-pay-request.ts`, `src/server/protocol/cumulative-dynamic-pay-request.ts` | Table-10 normal fields; one–ten account/amount/payer triples, bigint sum equals amount; `0,RefId` | Distribution data discarded after validation; same safe transaction creation | Existing Sale/callback/later handling available; dashboard label `CUMULATIVE_DYNAMIC_PAY` | `PROTOCOL` normal request/result; later reuse `DERIVED` |
| Local StartPay | `src/app/local/start-pay/route.ts`, `src/server/start-pay/request.ts` | URL-encoded exact `RefId`; local 303 to fake payment page | Lookup only; no lifecycle mutation; malformed/unknown form returns local error | No scenario/fault; not dashboard mutation | RefId POST `PROTOCOL`; route details internal |
| Fake Sale/payment page | `src/app/local/payment/[refId]/page.tsx`, `outcome/route.ts`, `src/server/payment/service.ts` | Fixed `SUCCESS` or cancellation outcome; no credential controls | Creates one Sale with local bigint SaleReferenceId; callback history appends separately; repeat rejected | Cancellation is bounded scenario; dashboard exposes Sale/callback event history | Callback names/result values `PROTOCOL`; page/action internal/scenario |
| Callback dispatcher | `src/server/callbacks/*` | Source field names, local URL-encoded POST | Records attempt/success/failure only; never changes Sale and never retries | No callback fault scripting; safe dashboard diagnostics omit destination/body | Fields/POST `PROTOCOL`; transport/security internal |
| `bpVerifyRequest` | `src/server/soap/verify-request.ts`, `src/server/protocol/verify-request.ts` | Table-2 fields; complete `{terminalId,saleOrderId,saleReferenceId}` lookup; result `0`, `43`, or `48` | Successful Sale confirms Verify; repeat verified returns `43`; known reversed returns `48`; unsupported state faults | `VERIFY_UNRESOLVED` saves attempt then faults; Verify supports PRE/POST transport profiles | Result mapping protocol; local axes/events internal |
| `bpSettleRequest` | `src/server/soap/settle-request.ts`, `src/server/protocol/settle-request.ts` | Table-3 fields; complete Sale lookup; result `0` only | Confirmed Verify records `SETTLEMENT_REQUESTED` via `SETTLE`; repeat/pre-Verify faults | PRE/POST transport profiles; dashboard says request received, never money moved | `0` protocol; eligibility/event internal |
| `bpVerifySettleRequest` | `src/server/soap/verify-settle-request.ts`, `src/server/protocol/verify-settle-request.ts` | Table-12 fields; complete Sale lookup; `0`, `43`, `45`, `48` | `0` atomically records verified and settlement requested via `VERIFY_SETTLE`; later known states do not mutate | PRE/POST transport profiles; dashboard preserves one combined event | Results protocol; atomic representation internal |
| `bpInquiryRequest` | `src/server/soap/inquiry-request.ts`, `src/server/protocol/inquiry-request.ts` | Table-4 fields and correlation | Fully correlated call faults without mutation; no numeric result emitted | No scenario/transport target; dashboard remains unchanged | Contract protocol; result `UNSPECIFIED` |
| `bpReversalRequest` | `src/server/soap/reversal-request.ts`, `src/server/protocol/reversal-request.ts` | Table-5 fields and correlation | Eligible-form call faults without mutation; it never creates `REVERSED` | `KNOWN_REVERSED` is separate local control; no transport target | Contract protocol; result/state effect `UNSPECIFIED` |
| Local dashboard/control APIs | `src/app/local/*`, `src/server/dashboard/query.ts`, scenarios/transport engines | Read DTOs and exact bounded JSON enums only | Reads pure; controls only existing RefId-scoped scenario/fault assignments | `/local`, transaction detail, scenarios, transport-fault APIs | Internal/scenario only |

All Pay-family RefId allocation happens before repository creation. Failed local RefId allocation cannot leave a pending, unreachable transaction.

## Source-to-code traceability and Pay-family comparison

| Operation | v1.39 evidence | Implemented source-backed slice | Limits |
| --- | --- | --- | --- |
| Pay | pp. 14–17 table 1, normal `0,RefId`, RefId POST, unique request number | Required normal input, RefId result, later callback field correlation | Sensitive optionals reject locally; exact SOAP/WSDL and provider duplicate result unspecified |
| Dynamic Pay | pp. 28–29 table 9; pp. 9–10 high-level Pay-like later process | Required normal input including `subServiceId`, `0,RefId` | Payout/provisioning/nonzero result unspecified; local later path is `DERIVED` |
| Cumulative Dynamic Pay | pp. 30–31 table 10; pp. 9–10 high-level Pay-like later process | Normal triples, maximum ten, bigint total check, `0,RefId` | Payout/account semantics/nonzero result unspecified; local later path is `DERIVED` |

Intentional differences: Dynamic requires `payerId` and `subServiceId`; Cumulative replaces them with parsed distribution `additionalData`. Cumulative alone checks documented distribution-total equality. All three share only `SIMULATOR_INTERNAL` terminal-wide `{terminalId, orderId}` uniqueness, opaque local RefIds, safe optional-field policy, and later local transaction plumbing.

No audited code upgrades `DERIVED` or `UNSPECIFIED` behavior to `PROTOCOL`. Dashboard event history was corrected: events are local diagnostics, not provider events; fake cancellation and forced reversal are scenarios.

## Cross-operation consistency

- `terminalId` stays bigint and is part of Pay uniqueness and every later complete correlation.
- Pay-family `orderId` is request identity; later Verify/Settle/VerifySettle/Inquiry/Reversal `orderId` is parsed bigint, non-unique, and never a lookup key.
- RefId is opaque, case-preserved, unique in repository, used only by local StartPay/scenario/fault selection.
- `SaleOrderId` is stored Pay `orderId`; local Sale requires it plus RefId to match. Callback publishes same value.
- `SaleReferenceId` is injectable local decimal bigint; later operations correlate all three Sale values.
- Amounts and all `long` values stay bigint; dashboard/callback stringify only at boundary.
- Sale callback, Verify, Settle, and combined VerifySettle use one immutable aggregate snapshot per accepted semantic transition. Callback delivery outcome remains independent of Sale.
- Event timestamps use injected clock. System clock is runtime default; `ManualClock`, sequence IDs, RefId generator, SaleReferenceId generator, and injected delay support deterministic tests.
- Local SOAP failures never fabricate a numeric provider code. Transport faults are one-shot and separate from aggregate events.

## Lifecycle / operation matrix

`Fault` means local SOAP Fault with no provider code and no mutation unless noted. `UNSPECIFIED` means source has no operation-specific result mapping.

| Local state | Verify | Settle | VerifySettle | Inquiry | Reversal |
| --- | --- | --- | --- | --- | --- |
| Awaiting Sale | Fault | Fault | Fault | Fault | Fault |
| Sale succeeded | `0` and local verified | Fault before Verify | `0` and local verified + settlement requested | Fault (`UNSPECIFIED`) | Fault; no prior Verify |
| Sale non-success | `0` may confirm after documented retry direction; local result/state model | Fault | Fault (`UNSPECIFIED`) | Fault (`UNSPECIFIED`) | Fault; no prior Verify |
| Verify attempted / unresolved | `VERIFY_UNRESOLVED` scenario Fault repeats; clear permits normal Verify | Fault | Fault (`UNSPECIFIED`) | Fault (`UNSPECIFIED`) | Fault; eligible-form result unspecified |
| Verified | `43` | `0`, local settlement request accepted | `43` | Fault (`UNSPECIFIED`) | Fault; result/state effect unspecified |
| Settlement requested | Fault | Fault (`UNSPECIFIED`) | `45` | Fault (`UNSPECIFIED`) | Fault; conservative local rejection (`DERIVED`) |
| Known reversed | `48` | Fault | `48` | Fault (`UNSPECIFIED`) | Fault; no Reversal result mapping |

`REVERSED` is never a result of local `bpReversalRequest`. It is known-state representation reachable only through bounded `KNOWN_REVERSED` scenario, then used by source-backed later Verify/VerifySettle `48` mappings.

## Emitted numeric provider result inventory

| Operation / surface | Code | v1.39 evidence | Meaning / condition | Classification |
| --- | ---: | --- | --- | --- |
| Pay | `0` | pp. 14–17 normal example | successful request, `0,RefId` | `PROTOCOL` result |
| Dynamic Pay | `0` | pp. 28–29 table 9 example | successful request, `0,RefId` | `PROTOCOL` result |
| Cumulative Dynamic Pay | `0` | pp. 30–31 table 10 example | successful request, `0,RefId` | `PROTOCOL` result |
| Fake Sale callback | `0` | p. 33 callback; table 11 pp. 36–37 | fixed local successful fake outcome | provider code, outcome selection `SIMULATOR_INTERNAL` |
| Fake Sale callback | `17` | table 11 pp. 36–37 | cardholder cancellation; only fake cancellation choice | `SIMULATOR_SCENARIO` |
| Verify | `0` | p. 21 and table 11 | correlated eligible local Sale confirmation | result `PROTOCOL`; state internal |
| Verify | `43` | p. 21 retry text and table 11 | local confirmed prior Verify | `PROTOCOL` |
| Verify | `48` | p. 21 retry text and table 11 | local known reversed | result `PROTOCOL`; known state internal/scenario |
| Settle | `0` | p. 22 table 3 | settlement request received for local verified Sale | result `PROTOCOL`; request record internal |
| VerifySettle | `0` | pp. 31–32 table 12 | eligible local successful Sale | result `PROTOCOL`; atomic record internal |
| VerifySettle | `43` | p. 32 retry text and table 11 | already verified | `PROTOCOL` |
| VerifySettle | `45` | p. 32 retry text and table 11 | settlement request already accepted | `PROTOCOL` |
| VerifySettle | `48` | p. 32 retry text and table 11 | known reversed | `PROTOCOL` result; known state internal/scenario |

No other table-11 code is emitted. In particular `41`, `42`, `45` for standalone Settle, and `0` for Inquiry/Reversal are not inferred from global catalogue wording.

## Local SOAP Fault inventory

All below are `SIMULATOR_INTERNAL`, except named scenario Fault. They are SOAP 1.1 local compatibility responses, never provider ResCodes.

| Fault | HTTP | Trigger |
| --- | ---: | --- |
| `Client` | 400 | malformed/non-UTF-8/oversize XML, DTD, unsupported envelope/operation, duplicate field, invalid/unknown field, local validation failure |
| `Client.DuplicatePayOrderId` | 409 | local Pay-family uniqueness violation while calling Pay |
| `Client.DuplicateDynamicPayOrderId` | 409 | same local invariant while calling Dynamic Pay |
| `Client.DuplicateCumulativeDynamicPayOrderId` | 409 | same local invariant while calling Cumulative Dynamic Pay |
| `Client.InvalidVerifyRequest` | 400 | missing/mismatched correlation or unsupported local Verify state |
| `SimulatorScenario.VerifyUnresolved` | 409 | deterministic unresolved Verify after recorded attempt (`SIMULATOR_SCENARIO`) |
| `Client.InvalidSettleRequest` | 400 | missing/mismatched correlation or non-verified/repeated local Settle |
| `Client.InvalidVerifySettleRequest` | 400 | missing/mismatched correlation or source-unmapped local state |
| `Client.InvalidInquiryRequest` | 400 | table-4 input/correlation or no source-backed Inquiry result |
| `Client.InvalidReversalRequest` | 400 | table-5 input/correlation or no source-backed Reversal result |
| `Server` | 500 | unexpected internal failure; safe generic text only |

One-shot transport profiles are not SOAP Faults: fixed 503 before/after execution, fixed malformed local XML after execution, or fixed 250 ms post-execution delay.

## SOAP compatibility audit

Local profile only: `POST /api/soap`, SOAP 1.1 Envelope/Body, local-name dispatch for nine supported operations, matching local response wrappers, no SOAPAction requirement, HTTP 400/409/500 local faults, and UTF-8 `text/xml` responses. It is not provider-exact WSDL/SOAP compatibility.

- Raw body cap: 65,536 bytes.
- Fatal UTF-8 decoding, DTD rejection, no external entity/resource handling, depth 32, nodes 256.
- Exactly one Body operation; direct text-only unique fields; unknown/unexpected fields reject.
- ASCII decimal parsing goes direct to bigint, avoiding JavaScript precision loss.
- Source does not establish namespaces, SOAPAction, wrapper names, element order, headers, error envelope, malformed behavior, or WSDL schema.

## Security, callback, and control-surface audit

Normal supported paths reject Pay-family `mobileNo`, `encPan`, and `enc`; fake payment UI has no PAN, PIN, CVV2, expiry, OTP, or banking credential fields. Credentials required structurally by later request tables are discarded before aggregate/events/dashboard. No raw SOAP, callback body/destination, password, PAN-like data, account/payer distribution, or internal stack reaches dashboard DTOs.

Callback delivery permits only configured exact HTTP(S) origins; URLs with credentials reject; redirects reject; timeout is three seconds; response drain is capped at 16 KiB; no retry/proxy/arbitrary callback endpoint exists. `localhost`/`127.0.0.1` need explicit allowlist entries. Exact-origin checking cannot prevent trusted DNS hostname rebinding after validation; this residual risk is documented.

`/local` reads explicit bounded DTOs only; GETs do not mutate transaction, callback, scenario, or fault state. Scenario and transport APIs accept exact bounded JSON keys/enums keyed by existing RefId. They cannot edit arbitrary state, inject ResCodes/XML/scripts, or proxy HTTP. Fake payment actions use stored transaction values and reject duplicate/cross-origin form posts; same actual local Host origin is accepted even when development runtime canonicalizes request URL to `localhost`.

## Determinism and tested journeys

Intentional runtime randomness: opaque RefId, simulator transaction/event IDs, and SaleReferenceId. Unit tests inject deterministic generators/clock; no unit test requires real waiting. Post-execution delay injects sleeper and is fixed at 250 ms. No timers, worker, retries, background task, database, or queue exists.

Browser HTTP journeys verified:

- Pay `0,RefId` → StartPay → fake success → controlled local callback → Verify `0` → Settle `0` → accurate dashboard lifecycle.
- Dynamic Pay normal `0,RefId` → local Sale → VerifySettle `0` (`DERIVED` local later flow).
- Cumulative Dynamic Pay normal `0,RefId` → local Sale → Verify `0` (`DERIVED` local later flow).
- cancellation produces callback `17`, with no false successful Sale.
- unresolved Verify repeats deterministic scenario Fault; clearing allows later normal Verify.
- known reversed produces Verify/VerifySettle `48`.
- post-Verify and post-VerifySettle transport failures commit state; retry produces `43`/`45`.
- post-Settle transport failure commits settlement request; repeat standalone Settle stays conservative local Fault.
- callback failure stays separate from Sale.

## Test coverage and validation

Focused coverage spans XML/parser, every request adapter/handler, repository/immutable lifecycle, scenarios, transport phases, callback SSRF boundaries, dashboard safe DTOs, local API validation, StartPay form origin, and Playwright journeys. Current totals after Goal 14: 125 unit tests in 29 files; 9 Chromium browser tests.

Validation completed:

| Command | Result |
| --- | --- |
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | pass: 29 files, 125 tests |
| `npm run test:e2e` | pass: 9 tests |
| `npm run build` | pass |
| `npm audit --omit=dev` | pass: 0 production vulnerabilities |
| `npm outdated` | inspected; no upgrades performed |
| `git diff --check` | pass |

Manual local UI review: desktop `/`, `/local`, fake payment page, and transaction detail render clearly as unofficial/local and expose no credential controls. Narrow 375×812 dashboard layout preserves labels, responsive cards, and visible local-only notice. Fake payment action was exercised through actual browser; same-host origin fix accepted legitimate `127.0.0.1` and resulting detail page showed only safe callback diagnostics.

## Documentation, versioning, limitations

README, architecture, protocol contract/SOAP/StartPay/uncertainty notes, testing, roadmap, scenarios, and dashboard terminology are consistent: settlement is request receipt, never completed money movement; Reversal SOAP does not create a reversal; Dynamic/Cumulative later flow is `DERIVED`; all provider-exact wire behavior remains unspecified.

`package.json` is already `0.1.0` and `private: true`; no publish, tag, or version change is needed. Outdated packages were reported by npm (including Playwright 1.63.0, React 19.3.0, ESLint 10.11.0, TypeScript 7.0.2); none was changed because this audit is not dependency upgrade work. No dependency was added.

Deliberately unsupported/blocked: Refund, Refund V2, Refund-to-PAN, Charge, SettleTime/automatic timing, PAN/mobile/encryption/profile flows, Mana/Iranian-goods/GamBonds, provider WSDL generation/exact wire behavior, callback proxy, persistence, authentication, production deployment, and refund inquiry specification absent from supplied source.

## Readiness criteria and decision

| Criterion | Result | Basis |
| --- | --- | --- |
| Source traceability | PASS | Every emitted provider result has operation-specific page evidence or is withheld/faulted. |
| Internal consistency | PASS | Shared bigint/correlation/Pay-family identity/lifecycle invariants audited; RefId atomicity fixed. |
| Safe uncertainty | PASS | Unmapped behavior remains local Fault or documented `UNSPECIFIED`. |
| Security | PASS WITH DOCUMENTED LIMITATION | Credential/card intake blocked in supported paths; trusted-host DNS rebinding remains inherent allowlist residual risk. |
| Determinism | PASS WITH DOCUMENTED LIMITATION | Runtime IDs are intentionally random; tests inject deterministic generators and no timer is required. |
| Merchant usability | PASS | Real HTTP Pay callback/Verify/Settle and Pay-family journeys pass. |
| Observability | PASS | Pure safe DTO dashboard covers state/events/scenario/fault/callback diagnostics. |
| Test confidence | PASS WITH DOCUMENTED LIMITATION | Core boundaries/lifecycles/browser journeys covered; exact provider WSDL behavior intentionally outside scope. |
| Documentation | PASS | Durable source/uncertainty/lifecycle/security/release audit is aligned. |

**READY FOR V0.1 RELEASE PREPARATION**

Required actions before release preparation: NONE.

Recommended Goal 15: release-preparation checklist and human approval workflow only; do not execute it here.
