# Protocol uncertainties

This ledger prevents simulator invention. `DOCUMENTED` means direct v1.39 statement; `DERIVED` is narrow restatement; `SIMULATOR_DECISION` is local design; `UNSPECIFIED` must not be guessed.

| Classification | Item | Status / handling |
| --- | --- | --- |
| DOCUMENTED | High-level stack | Source names SOAP/XML over HTTP or HTTPS. |
| UNSPECIFIED | SOAP namespace, SOAPAction, WSDL schema, SOAP envelope, operation wrapper, element order, serialization, and transport headers | Do not implement or claim until directly supported by source material. |
| UNSPECIFIED | Exact response-string grammar beyond illustrated Pay `ResCode, RefId` and response-code strings | Preserve documented identifiers; establish parsing compatibility only in later source-backed work. |
| UNSPECIFIED | Full required/optional semantics for every specialized-operation parameter | Specialized methods deferred; extract only when their Goal begins. |
| UNSPECIFIED | Simulator endpoint paths and local redirect URLs | Must be explicit `SIMULATOR_DECISION`, never source claim. |
| SIMULATOR_DECISION | In-memory, replaceable transaction repository | Planned initial persistence; no database in initial scope. |
| SIMULATOR_DECISION | Callback allowlist, SSRF protections, timeout/response caps, and XML size/DTD/entity protections | Security baseline imposed by project, beyond documented merchant domain rule. |
| SIMULATOR_DECISION | Clock, timer execution, state representation, idempotency mechanics, diagnostics, and UI | Required to simulate; source does not define implementation mechanism. |
| UNSPECIFIED | Exact payment-page UI/card data entry flow | Never collect real credentials; later fake UI must be simulator-only. |
| DERIVED | `SaleOrderId` correlation | Source states callback `SaleOrderId` must match Pay `orderId` for same transaction. |
| DOCUMENTED | `encPan` table casing versus redirect examples using `EncPan`; `panHiddenMode` table versus `HiddenMode` redirect example | Preserve source evidence; do not normalize or infer a wire mapping without validation. |

Add discoveries with source page and classification before code depends on them.
