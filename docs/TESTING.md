# Testing

Goal 1 coverage is intentionally small: Vitest verifies home-page identity/safety copy; Playwright checks same behavior in Chromium.

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`test:e2e` starts local Next development server at `127.0.0.1:3000` unless one is already running. Browser binaries are installed separately with `npx playwright install chromium` when absent.

Future tests must name behavior class (`PROTOCOL`, `SIMULATOR_INTERNAL`, or `SIMULATOR_SCENARIO`) and cite source page/uncertainty for protocol claims. Do not write imagined protocol tests.
