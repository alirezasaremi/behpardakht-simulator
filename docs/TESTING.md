# Testing

Goal 1 coverage is intentionally small: Vitest verifies home-page identity/safety copy; Playwright checks same behavior in Chromium.

Goal 2 Vitest coverage exercises transaction creation, lifecycle transitions, rejection/no-mutation behavior, append-only event order, manual-clock timestamps, repository isolation, Pay-order uniqueness, and protocol-correlation lookup.

Goal 3 Vitest coverage adds `bpPayRequest` application and SOAP/HTTP-boundary tests. They cover bigint intake beyond JavaScript safe-number range, deterministic and case-preserved RefId values, successful transaction persistence, Pay order uniqueness per terminal, no password persistence/events, simulator-internal duplicate fault, malformed XML, unsupported operations, invalid/missing input, DTD rejection, and body/field safety limits. Tests instantiate a local `Request` and assert returned `Response`; no external server, provider URL, or real credential is used.

Goal 4 adds unit and contract tests for bounded local StartPay forms, RefId lookup, success/non-success Sale transitions, deterministic bigint SaleReferenceIds, callback payload names/correlation/FinalAmount, fake masked PAN, exact-origin allowlisting, protocol/credentials rejection, redirect refusal, timeout, bounded response consumption, callback event history, duplicate action rejection, and transport-failure separation from Sale. The route contract proves original stored amount/order/callback values are used. Playwright runs `Pay -> local StartPay POST -> fake success -> completion` and asserts page warnings plus zero credential input controls. Callback transport is separately controlled/mocked; no public host is contacted.

Goal 5 adds unit and local SOAP contract coverage for table-2 Verify parsing, bigint precision, successful `Pay -> Sale -> Verify`, complete terminal/sale-order/sale-reference correlation, non-unique Verify `orderId`, `0` success, `43` already verified, ordered immutable events, no settlement/callback, password omission, malformed input, and rejection with no partial mutation. Expected provider codes are cited in [VERIFY.md](protocol/VERIFY.md); unknown/mismatching correlation remains a local SOAP fault.

Goal 6 adds unit/local SOAP contract coverage for table-3 Settle parsing, bigint precision, `Pay -> Sale -> Verify -> Settle`, complete correlation, non-unique Settle `orderId` equal to `saleOrderId`, `0` request-received result, immutable settlement event/state, preserved Sale/Verify, no callback, password omission, and no-mutation SOAP Faults for malformed/mismatched/pre-Verify/repeated Settle. [SETTLE.md](protocol/SETTLE.md) audits every provider result: only `0`.

Goal 7 adds unit/local SOAP contract coverage for table-4 Inquiry and table-5 Reversal parsing, bigint precision, complete correlation, non-unique request `orderId`, password omission, no-mutation local faults where result mapping is unspecified, documented Reversal ordering, derived settlement boundary, and Verify `48` for simulator known-reversed state. No browser controls were added; these are merchant/server operations. [INQUIRY.md](protocol/INQUIRY.md) and [REVERSAL.md](protocol/REVERSAL.md) audit returned codes.

Goal 8 adds unit/local SOAP contract coverage for table-12 VerifySettle parsing, bigint precision, source-based non-unique `orderId`, complete Sale correlation, atomic `0` state transition, one combined-operation event, password omission, no callback, `43` already verified, `45` already settled, `48` known reversed, and no-mutation local faults for malformed/non-success/mismatched requests. No browser control is added. [VERIFY_SETTLE.md](protocol/VERIFY_SETTLE.md) audits every returned code.

Goal 9 adds scenario-engine/local-control contract coverage: NORMAL default/isolation, supported assignment, unknown rejection, clear-without-rollback, no generic state mutation, deterministic repeated unresolved Verify, SOAP Fault without provider result, later normal Verify after clear, forced REVERSED audit event/no fake Reversal event, post-settlement force rejection, source-backed Verify/VerifySettle `48` once state known. Existing Goal 4 dispatcher tests cover callback success/failure. No dashboard/browser flow added.

Goal 10 adds transport-engine/control/SOAP coverage: bounded profiles/operations, isolation, one-shot claims, clear without aggregate mutation, rejected arbitrary values, PRE Verify precedence/no mutation, POST Verify `503` then `43`, POST VerifySettle `503` then `45`, POST Settle committed state with conservative retry fault, fixed malformed fixture, injected 250 ms sleeper, and NORMAL regression. No dashboard/browser controls added.

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`test:e2e` starts local Next development server at `127.0.0.1:3000` unless one is already running. Browser binaries are installed separately with `npx playwright install chromium` when absent.

Future tests must name behavior class (`PROTOCOL`, `SIMULATOR_INTERNAL`, or `SIMULATOR_SCENARIO`) and cite source page/uncertainty for protocol claims. Do not write imagined protocol tests.
