<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project guardrails

## Purpose and source of truth

Build an unofficial, local-only Behpardakht Mellat payment-gateway simulator for development and tests. No real payment ever occurs.

**Only** supplied *Mellat PGW Technical Document v1.39, Azar 1404* may establish Behpardakht protocol behavior. Client applications, prior integrations, tutorials, packages, generic SOAP practice, and assumptions are never protocol authority. Never invent undocumented Behpardakht behavior; record it in `docs/protocol/UNCERTAINTIES.md`.

Classify behavior in code and docs:

- `PROTOCOL`: explicitly supported by v1.39.
- `SIMULATOR_INTERNAL`: implementation choice, never claimed Behpardakht behavior.
- `SIMULATOR_SCENARIO`: simulator-only test/failure injection.

## Architecture and scope

Keep future server boundaries narrow: `src/server/protocol`, `soap`, `transactions`, `callbacks`, `scenarios`, and `security`. App Router UI is separate from protocol/service/domain work. In-memory repository is initial design; no database, Prisma, Redis, queues, external infrastructure, generic HTTP proxy, or speculative protocol implementation.

Inspect before modifying. Preserve useful existing work, avoid broad rewrites, and implement only current Goal. Do not add SOAP/XML libraries before exact compatibility requirements are established.

## Code and dependencies

Use TypeScript strict mode. Prefer small typed modules, explicit validation at boundaries, named domain concepts, and English code/docs. Avoid `any`, unchecked casts, hidden side effects, and duplicated protocol facts. Add runtime dependencies only when current Goal needs them; document why. Keep formatting/lint clean.

## Security

Never collect, log, store, commit, or render real PAN/card credentials, PIN, CVV2, OTP, banking credentials, or secrets. Use environment variables for secrets; commit neither values nor `.env` files.

Future callbacks must be explicitly allowlisted: parse and validate URLs, prevent SSRF, do not blindly follow redirects, and bound outbound time and response size. Bound inbound SOAP/XML size; safely parse XML; reject DTDs, external entities, and entity-expansion attacks. Validate every protocol input, safely render diagnostics, and never expose arbitrary outbound HTTP requests.

## Tests, docs, and completion

Run only relevant local commands: `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build`. Add focused unit coverage plus browser coverage when behavior changes. Do not invent protocol tests for missing protocol code.

Update architecture, development, testing, roadmap, protocol, scenario, and uncertainty docs with implementation changes. Definition of done: scoped change works locally; lint, typecheck, unit tests, browser tests, and production build pass when applicable; docs and uncertainty ledger are current; no real credentials or protocol invention introduced.

Final reports must list changed files, commands/tests and results, dependencies added with reason, and newly discovered protocol uncertainties.
