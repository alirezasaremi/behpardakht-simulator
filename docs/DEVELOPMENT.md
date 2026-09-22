# Development

Node.js and npm are required. Release-preparation verification used Node.js `22.19.0` and npm `10.9.3`; `package.json` has no `engines` field, so this is a tested runtime fact, not a declared support range. This App Router project uses TypeScript strict mode, React, Tailwind CSS, and a shadcn/ui `components.json` foundation. No shadcn component is generated in Goal 1; add UI dependencies only with a concrete component need.

```bash
npm ci
npm run dev
```

`package-lock.json` is committed; prefer `npm ci` for reproducible clean installs. `npm install` is appropriate only when deliberately changing dependencies and lockfile.

`npm run typecheck` invokes `next typegen` before `tsc --noEmit`. Next.js generates ignored route-aware declarations, including `next-env.d.ts`; this keeps typechecking reproducible in a clean clone without tracking generated files.

Open `http://localhost:3000`. This local simulator must never receive real card/PIN/CVV2/OTP credentials.

Open `http://localhost:3000/local` for local developer dashboard. It manually refreshes bounded process-memory diagnostics from safe read-only DTOs. Detail pages can only assign/clear existing semantic scenarios and one-shot transport faults; they are not transaction editors. See [dashboard](DASHBOARD.md).

Before a change, inspect existing code and `AGENTS.md`. Derive protocol only from a supplied v1.39 PDF, using `docs/protocol/SOURCE.md` as a page-reference index rather than protocol authority. Never add private client/project data or an unrelated local source path. Mark non-source behavior `SIMULATOR_INTERNAL` or `SIMULATOR_SCENARIO`; add unknowns to `docs/protocol/UNCERTAINTIES.md`.

Local SOAP service is `POST http://localhost:3000/api/soap`. It accepts only [SOAP_COMPATIBILITY.md](protocol/SOAP_COMPATIBILITY.md), not a production Behpardakht endpoint. Use fake local merchant values only.

Safe normal-path `bpDynamicPayRequest` uses table-9 required fields, including bigint-safe `subServiceId`, and returns documented `0,RefId`. Dynamic Pay directly names Pay-like confirmation, settlement, reversal, and inquiry; existing fake local Sale/callback plumbing is `DERIVED` compatibility. Do not send `mobileNo`, `encPan`, or `enc`: local simulator rejects them to avoid personal/card/identity intake. `subServiceId` is discarded; provisioning and payout execution are not simulated. See [Goal 12 note](protocol/GOAL_12_DYNAMIC_PAYMENT_NOTE.md).

Safe normal-path `bpCumulativeDynamicPayRequest` uses table-10 required fields. Its `additionalData` has one to ten `account-id,amount,payer-id` triples, comma-delimited inside each triple and semicolon-delimited between triples; local bigint sum must equal request `amount`. Table-10's empty payer-id/terminal-semicolon example is accepted. Account and payer identifiers are discarded. Do not send `mobileNo`, `encPan`, or `enc`; local simulator rejects them. No payout, settlement, provider provisioning, or provider error mapping is simulated. See [Goal 13 note](protocol/GOAL_13_CUMULATIVE_DYNAMIC_PAY_NOTE.md).

After a successful Sale/callback, call `bpVerifyRequest` at same endpoint. Use exact source table-2 fields; `saleOrderId` is original Pay `orderId`, while Verify `orderId` is non-unique and may equal it. Keep callback `ResCode` separate from Verify response code. See [VERIFY.md](protocol/VERIFY.md); password is compatibility input only and is never persisted/logged.

After Verify `0`, call `bpSettleRequest` at same endpoint with exact table-3 fields. Settle `saleOrderId` stays original Pay `orderId`; `saleReferenceId` stays callback reference; Settle `orderId` is non-unique and may equal `saleOrderId`. Local `0` means request received, never real deposit confirmation. See [SETTLE.md](protocol/SETTLE.md); fake password remains unpersisted/unlogged.

After successful Sale, merchant may instead call `bpVerifySettleRequest` at same endpoint with exact table-12 fields. VerifySettle `orderId` is non-unique and may equal `saleOrderId`; only `{ terminalId, saleOrderId, saleReferenceId }` identifies Sale. Local `0` atomically records verification and settlement request; `43`, `45`, and `48` are source-backed known-state results. See [VERIFY_SETTLE.md](protocol/VERIFY_SETTLE.md). It sends no callback and never represents a real deposit.

`bpInquiryRequest` (table 4) and `bpReversalRequest` (table 5) use same six field names/types and complete `{ terminalId, saleOrderId, saleReferenceId }` correlation. Both request `orderId` values are non-unique and may equal `saleOrderId`. Their sections name response-code strings but no operation-specific response mapping, so valid local calls fault without lifecycle mutation. See [INQUIRY.md](protocol/INQUIRY.md) and [REVERSAL.md](protocol/REVERSAL.md). No automatic reversal/settlement timer exists.

After a successful Pay SOAP result, submit a browser form with its exact case-sensitive RefId to `POST http://localhost:3000/local/start-pay`. The local endpoint accepts URL-encoded `RefId` only, then shows fake developer payment controls. It accepts no amount, order, terminal, callback, or Sale identifier from browser action input.

Callback delivery is disabled unless `SIMULATOR_CALLBACK_ALLOWED_ORIGINS` contains an exact allowed `http:` or `https:` origin. No variable is required for simplest local flow. Copy `.env.example` to ignored `.env.local` only when testing callback delivery, then set a controlled local origin; example: `SIMULATOR_CALLBACK_ALLOWED_ORIGINS=http://127.0.0.1:4010`. This optional security-sensitive allowlist is not a credential and must never contain untrusted or production endpoints. Explicitly configure localhost or `127.0.0.1`; neither is implicitly trusted. The local dispatcher rejects credentials in URLs, redirects, and destinations outside this allowlist.

For deterministic transaction-local test conditions, inspect `GET /local/api/scenarios`, then assign only enumerated scenario names using `POST /local/api/scenarios` JSON `{"refId":"<Pay RefId>","scenario":"VERIFY_UNRESOLVED"}`. Clear with `DELETE` JSON `{"refId":"<Pay RefId>"}`. This control surface is `SIMULATOR_SCENARIO`, accepts no Behpardakht fields or arbitrary provider codes, disappears on restart. See [scenarios](scenarios/README.md).

For merchant wire-failure testing after local Sale, use `GET`/`POST`/`DELETE /local/api/transport-faults`. Assignment needs exact JSON `{"refId":"<Pay RefId>","profile":"POST_EXECUTION_HTTP_FAILURE","operation":"bpVerifyRequest"}`. It is separate one-shot `SIMULATOR_SCENARIO`, never SOAP input. See [transport faults](scenarios/TRANSPORT_FAULTS.md).

Use no database, SOAP/XML parser, proxy, external service, or extra runtime package until needed by an approved Goal. Goal 3 uses `saxes` solely for safe, event-driven XML parsing behind `src/server/soap`.
