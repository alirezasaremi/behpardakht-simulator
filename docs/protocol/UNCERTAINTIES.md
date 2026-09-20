# Protocol uncertainties

This ledger prevents simulator invention. `DOCUMENTED` means direct v1.39 statement; `DERIVED` is narrow restatement; `SIMULATOR_DECISION` is local design; `UNSPECIFIED` must not be guessed.

| Classification | Item | Status / handling |
| --- | --- | --- |
| DOCUMENTED | High-level stack | Source names SOAP/XML over HTTP or HTTPS. |
| DOCUMENTED | Provider WSDL locations | Printed source page 12 lists test `https://pgw.dev.bpmellat.ir/pgwchannel/services/pgw?wsdl` and operational `https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl`. PDF does not embed WSDL schema. |
| UNSPECIFIED | SOAP namespace, SOAPAction, WSDL schema content, SOAP envelope, operation wrapper, element order, serialization, and transport headers | Goal 3 local profile must not be claimed as provider behavior. |
| UNSPECIFIED | Exact response-string grammar beyond illustrated Pay `ResCode, RefId` and response-code strings | Preserve documented identifiers; establish parsing compatibility only in later source-backed work. |
| UNSPECIFIED | Full required/optional semantics for every specialized-operation parameter | Specialized methods deferred; extract only when their Goal begins. |
| SIMULATOR_DECISION | Goal 3 local SOAP endpoint and profile | `POST /api/soap`, SOAP 1.1 envelope, operation local-name matching, local response wrapper/faults, 400 fault status, and content type are usability choices. See `SOAP_COMPATIBILITY.md`. |
| UNSPECIFIED | Exact provider behavior for malformed SOAP/XML, unsupported operation, missing XML field, oversized input, and unauthorized/mismatched callback domain | Goal 3 uses local transport faults. It maps none of these to a provider ResCode. |
| UNSPECIFIED | Provider response for duplicate Pay `orderId` | Source says `bpPayRequest` `orderId` must be unique and duplicate requests return an error; table 11 separately labels `41` duplicate request number. No source text ties `41` to duplicate Pay. Goal 3 enforces uniqueness internally and returns a local HTTP 409 SOAP Fault, not a Behpardakht ResCode. |
| SIMULATOR_DECISION | In-memory, replaceable transaction repository | Planned initial persistence; no database in initial scope. |
| SIMULATOR_DECISION | Callback allowlist, SSRF protections, timeout/response caps, and XML size/DTD/entity protections | Security baseline imposed by project, beyond documented merchant domain rule. |
| SIMULATOR_DECISION | Clock, timer execution, state representation, idempotency mechanics, diagnostics, and UI | Required to simulate; source does not define implementation mechanism. |
| UNSPECIFIED | Exact payment-page UI/card data entry flow | Never collect real credentials; later fake UI must be simulator-only. |
| DERIVED | `SaleOrderId` correlation | Source states callback `SaleOrderId` must match Pay `orderId` for same transaction. |
| DOCUMENTED | `encPan` table casing versus redirect examples using `EncPan`; `panHiddenMode` table versus `HiddenMode` redirect example | Preserve source evidence; do not normalize or infer a wire mapping without validation. |
| UNSPECIFIED | Whether `bpReversalRequest` may succeed after an unresolved/timed-out Verify response, rather than only a confirmed Verify result | Source says Reversal follows Verify but does not specify this outcome prerequisite. Goal 2 records a prior Verify attempt as internal ordering only; future adapter must not claim provider acceptance from domain state. |

Add discoveries with source page and classification before code depends on them.
