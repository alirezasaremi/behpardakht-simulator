# Deterministic local scenarios

Goal 9 provides deliberately small `SIMULATOR_SCENARIO` engine. It is local development/test control, never Behpardakht behavior, never changes SOAP request fields, XML parsing, SOAP serialization, repository correlation, or documented provider mappings.

## Control and lifetime

Use `GET http://localhost:3000/local/api/scenarios` to inspect supported names. Use `POST` with bounded `application/json` exactly shaped as `{"refId":"<opaque local RefId>","scenario":"VERIFY_UNRESOLVED"}` to assign one. Use `DELETE` with exactly `{"refId":"<opaque local RefId>"}` to clear it. `RefId` is pre-existing local Pay result; it is not encoded or changed to select scenario.

Only `NORMAL`, `VERIFY_UNRESOLVED`, `KNOWN_REVERSED` accepted. No arbitrary result-code, state, URL, response-body, status, script control. Unknown fields, malformed JSON, unknown RefIds, unknown scenario names reject locally. Route is conspicuous simulator-local `/local/api/` namespace, not `/api/soap`.

Assignments transaction-scoped, process memory only. Process restart loses transactions and scenario selections. `NORMAL` default has exactly pre-Goal-9 behavior.

## Scenarios

`VERIFY_UNRESOLVED` applies after normal documented Verify correlation and only to eligible successful local Sale. Each `bpVerifyRequest` appends `VERIFY_ATTEMPTED`, leaves verification `ATTEMPTED` and settlement `NOT_REQUESTED`, then returns HTTP 409 local SOAP Fault `SimulatorScenario.VerifyUnresolved`. It returns **no Behpardakht numeric ResCode**: v1.39 tells merchants retry nonzero Verify responses but establishes no operation-specific universal unresolved result code. Repeated calls stay unresolved deterministically. Clear preserves attempts; later eligible Verify follows normal behavior and can confirm to documented `0`. Inquiry stays conservative local fault because scenario knowledge is not provider Inquiry knowledge.

`KNOWN_REVERSED` local semantic force action, not `bpReversalRequest`. It accepts only successful-Sale transactions with unresolved verification, no settlement request, no prior reversal; these are `SIMULATOR_SCENARIO` safety constraints. It atomically records `REVERSED` plus `SCENARIO_STATE_FORCED { scenario: "KNOWN_REVERSED" }`. Never fake Reversal SOAP event. Once state exists, existing `PROTOCOL` handlers return documented `48` for Verify and VerifySettle. Clear configuration never restores state/history.

No callback-delivery scenario added. `NORMAL` leaves existing Goal 4 dispatcher behavior unchanged: each accepted local payment action attempts one synchronous callback delivery; duplicate payment actions reject, and delayed or duplicate callbacks cannot be injected. An explicitly allowlisted controlled 2xx receiver records delivery success; rejected, timeout, transport, non-2xx receiver records failure. Both stay separate from successful Sale and retain all SSRF protections.

Goal 10 uses distinct `/local/api/transport-faults` registry, not scenario names or SOAP fields. It provides one-shot merchant-to-gateway observation controls; PRE prevents scenario/protocol execution, POST follows normal execution/commit. See [transport faults](TRANSPORT_FAULTS.md).

Goal 11 dashboard exposes these exact bounded controls on the relevant `/local/transactions/[id]` page. It calls this existing API rather than adding lifecycle editing, and its scenario indicator is a safe process-local diagnostic only. See [dashboard](../DASHBOARD.md).

## Extension rule

Future scenario must name semantic condition, be deterministic/transaction-scoped where possible, state lifecycle effects, label control mechanics `SIMULATOR_SCENARIO`, preserve `NORMAL`, test/document separately source-backed provider response. Must not add fake Behpardakht request fields, arbitrary ResCode injection, generic state editing, arbitrary callback destinations/payloads, transport-fault machinery, timers, persistence, randomness, scripts, proxy.
