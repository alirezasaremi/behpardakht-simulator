# Deterministic SOAP transport faults

Goal 10 adds narrow `SIMULATOR_SCENARIO` control for merchant-to-gateway SOAP transport testing. It is not Behpardakht behavior; v1.39 does not establish injected status, malformed XML, or delay below.

## Catalog and commit semantics

`NORMAL` default changes nothing. Non-normal assignment is transaction-scoped, process-memory only, targets one supported operation, and consumes once only when operation reaches configured phase. Unrelated calls do not consume it.

- `PRE_EXECUTION_HTTP_FAILURE`, Verify/Settle/VerifySettle: request passes body/XML/input safety and transaction correlation, then fixed HTTP `503` plain-text response. Protocol handler and semantic scenario do not run; no domain mutation.
- `POST_EXECUTION_HTTP_FAILURE`, Verify/Settle/VerifySettle: handler completes and commits normal domain state, then fixed HTTP `503` replaces SOAP response.
- `POST_EXECUTION_MALFORMED_SOAP`, Verify/Settle/VerifySettle: handler completes and commits, then HTTP `200` returns fixed owned fixture `<simulator-malformed-soap` with `text/xml`. Caller cannot configure fixture.
- `POST_EXECUTION_DELAY`, Verify/Settle/VerifySettle: handler completes and commits, then waits exactly 250 ms before normal SOAP response. Duration fixed; test sleeper is injected, so unit tests do not wait.

Post assignment stays pending if handler faults before normal result exists. PRE assignment consumes at interception. Synchronous in-process claim removes assignment before response construction; distributed concurrency guarantees remain out of scope. `bpPayRequest` is excluded: transaction-scoped control needs pre-existing RefId and Goal 10 adds no reservation/magic-order system. Inquiry/Reversal are excluded because they currently have no successful SOAP result to transform.

## Precedence and separation

Transport registry/history is separate from aggregate lifecycle events and Goal 9 `ScenarioEngine`. PRE fault wins after parse/correlation but before scenario/protocol. Otherwise scenario/protocol runs normally, then POST fault changes only merchant observation. `VERIFY_UNRESOLVED` is not transport fault. `KNOWN_REVERSED` remains state: post Verify HTTP failure may suppress documented `48` without changing reversal state.

Post Verify failure commits Verify; retry naturally returns documented `43`. Post VerifySettle failure commits combined state; retry naturally returns documented `45`. Post Settle failure commits settlement request; retry remains existing conservative local SOAP Fault because v1.39 lacks repeated standalone Settle code. Transport uncertainty does not create Inquiry result mapping.

No callback transport scripting added. Callback protections remain unchanged.

## Local control API

`GET /local/api/transport-faults` lists bounded profile/operation enums. `POST` requires exact bounded JSON:

```json
{"refId":"<existing opaque local RefId>","profile":"POST_EXECUTION_HTTP_FAILURE","operation":"bpVerifyRequest"}
```

`DELETE` requires exact `{"refId":"<existing opaque local RefId>"}`. Unknown RefIds, extra fields, arbitrary status/body/XML/headers/delay/scripts/URLs/operation strings reject. `NORMAL` clears assignment. Clearing never changes lifecycle.

Goal 11 displays pending assignments and invokes only this bounded control API from local transaction detail. Dashboard reads do not claim or consume faults. See [dashboard](../DASHBOARD.md).

## Deferred connection abort

DEFERRED. Current Next.js Node Route Handler uses documented Web `Request`/`Response` APIs; no documented safe underlying connection-abort primitive. HTTP failure is not called connection abort.

## Extension rule

Add profile only if semantic, bounded, deterministic, phase/commit behavior explicit, safely testable, and `SIMULATOR_SCENARIO`. Never add arbitrary wire scripting, persistence, randomness, lifecycle timer, socket hack, or Behpardakht claim without v1.39 evidence.
