# Local developer dashboard

Goal 11 provides local developer diagnostics at `/local`. It is unofficial simulator tooling, not Behpardakht, Shaparak, merchant administration, production payment UI, or banking dashboard. It is process-local/in-memory: restart loses all transactions, scenario assignments, and pending transport faults.

## Routes and refresh

- `/local`: overview, bounded transaction list, local search/filter, capability/status cards, and classification legend.
- `/local/transactions/[id]`: safe transaction detail, lifecycle, callback diagnostics, event history, and existing bounded controls.
- `GET /local/api/transactions?limit=1..100`: explicit list DTO and summary; default 50.
- `GET /local/api/transactions/[id]`: explicit detail DTO or safe `404`.

Manual **Refresh** fetches current process-memory state. No polling, WebSocket, SSE, persistence, or background task exists.

## Safe query boundary

`src/server/dashboard` maps fields deliberately; it never returns an aggregate directly. List fields are `transactionId`, `refId`, `terminalId`, `orderId`, `saleOrderId`, `saleReferenceId`, `amount`, `saleState`, `verificationState`, `settlementState`, `reversalState`, `lifecycleState`, `callback`, `scenario`, `pendingTransportFault`, `createdAt`, and `updatedAt`. Detail adds `saleResCode`, `saleCompletedAt`, `verificationAttemptedAt`, `verifiedAt`, `settlementRequestedAt`, `reversedAt`, and safe mapped `events`.

All bigint identifiers are decimal strings. RefId is preserved verbatim and case-sensitive. Callback diagnostics contain only attempt/status/timestamps/failure category/HTTP status; destination URL and callback body are absent. Events contain only `eventId`, timestamp, type, classification, and allowlisted scalar metadata.

No DTO exposes `userPassword`, any password/credential, raw SOAP, PAN/card fields, PIN, CVV2, OTP, callback URL/body, internal error, or stack. UI uses ordinary text rendering; it never uses HTML injection for metadata.

## Detail behavior

Lifecycle display represents actual state axes/history: Pay created, Sale, Verify, settlement request, and a distinct known-reversed note. It does not claim money moved or that combined VerifySettle represented separate calls. Callback failure stays independent of Sale state.

Scenario controls use existing `/local/api/scenarios` enums only: `NORMAL`, `VERIFY_UNRESOLVED`, `KNOWN_REVERSED`. Transport controls use existing `/local/api/transport-faults` enums only: `NORMAL`, `PRE_EXECUTION_HTTP_FAILURE`, `POST_EXECUTION_HTTP_FAILURE`, `POST_EXECUTION_MALFORMED_SOAP`, `POST_EXECUTION_DELAY`, and Verify/Settle/VerifySettle target operations. These are `SIMULATOR_SCENARIO`; PRE means no execution, while POST means committed operation before changed merchant observation.

Dashboard GETs and page rendering are pure reads: no aggregate mutation, event append, callback dispatch, protocol operation, scenario consumption, or transport-fault consumption. Controls never create generic transaction editing.

## Classification

- `PROTOCOL`: behavior grounded in supplied v1.39.
- `SIMULATOR_INTERNAL`: local diagnostic/implementation detail.
- `SIMULATOR_SCENARIO`: deterministic developer-controlled simulation behavior.
- `UNSPECIFIED`: v1.39 does not establish enough semantics for a provider claim.

The responsive table scrolls safely on narrow widths; long opaque identifiers wrap in detail views. All controls have labels, keyboard-native HTML elements, status text, and color-independent labels.
