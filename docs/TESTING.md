# Testing

Goal 1 coverage is intentionally small: Vitest verifies home-page identity/safety copy; Playwright checks same behavior in Chromium.

Goal 2 Vitest coverage exercises transaction creation, lifecycle transitions, rejection/no-mutation behavior, append-only event order, manual-clock timestamps, repository isolation, Pay-order uniqueness, and protocol-correlation lookup.

Goal 3 Vitest coverage adds `bpPayRequest` application and SOAP/HTTP-boundary tests. They cover bigint intake beyond JavaScript safe-number range, deterministic and case-preserved RefId values, successful transaction persistence, Pay order uniqueness per terminal, no password persistence/events, simulator-internal duplicate fault, malformed XML, unsupported operations, invalid/missing input, DTD rejection, and body/field safety limits. Tests instantiate a local `Request` and assert returned `Response`; no external server, provider URL, or real credential is used.

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`test:e2e` starts local Next development server at `127.0.0.1:3000` unless one is already running. Browser binaries are installed separately with `npx playwright install chromium` when absent.

Future tests must name behavior class (`PROTOCOL`, `SIMULATOR_INTERNAL`, or `SIMULATOR_SCENARIO`) and cite source page/uncertainty for protocol claims. Do not write imagined protocol tests.
