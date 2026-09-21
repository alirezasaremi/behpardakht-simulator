# Unofficial Behpardakht Payment Gateway Simulator

Version `0.1.0`. Local-only development and test simulator for selected Behpardakht Mellat payment-gateway flows. Independent project; not affiliated with, endorsed, certified, or operated by Behpardakht Mellat. It is not a real payment gateway and must never process real payments or credentials.

Protocol facts come only from supplied *Mellat PGW Technical Document v1.39* (Azar 1404). This repository does not redistribute that PDF; see [source notes](docs/protocol/SOURCE.md).

## Safety and scope

Use synthetic merchant values only. Never send, enter, log, store, or commit real PAN, PIN, CVV2, OTP, banking credentials, secrets, or production callback data.

Supported `0.1.0` local paths: `bpPayRequest`, normal-path `bpDynamicPayRequest`, normal-path `bpCumulativeDynamicPayRequest`, fake local StartPay/Sale/callback, `bpVerifyRequest`, `bpSettleRequest`, and `bpVerifySettleRequest`. `bpInquiryRequest` and `bpReversalRequest` validate/correlate their documented request shapes but safely return local Faults where v1.39 supplies no operation-specific result mapping.

Not implemented: real payment processing, provider WSDL/wire compatibility, merchant authentication, persistence, callback retries, automatic settlement/reversal timers, payout/provisioning, Refund/Charge flows, and real bank/deposit actions. See [limitations and uncertainties](docs/protocol/UNCERTAINTIES.md).

## Quick Start

Tested release-preparation runtime: Node.js `22.19.0`, npm `10.9.3`. No `engines` field exists, so these are verification facts, not a declared support range.

```bash
git clone https://github.com/alirezasaremi/behpardakht-simulator.git
cd behpardakht-simulator
npm ci
cp .env.example .env.local # optional; needed only to deliver callbacks to controlled local receiver
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local developer dashboard: [http://localhost:3000/local](http://localhost:3000/local).

No environment variable is required for simplest local flow. Callbacks are disabled by default. To opt in for one controlled receiver, set exact origins in `.env.local`, for example `SIMULATOR_CALLBACK_ALLOWED_ORIGINS=http://127.0.0.1:4010`. This security-sensitive allowlist must never contain untrusted hosts. See [environment and development notes](docs/DEVELOPMENT.md).

## First merchant flow

1. Start server. Send fake `bpPayRequest` XML to `POST /api/soap`; use [local SOAP example](docs/protocol/SOAP_COMPATIBILITY.md#local-request-example). Extract `RefId` from `0,RefId` response.
2. POST that exact case-sensitive `RefId` to local StartPay:

```html
<form action="http://localhost:3000/local/start-pay" method="post">
  <input type="hidden" name="RefId" value="local_example_refid">
  <button type="submit">Open fake local payment page</button>
</form>
```

3. Choose fake success. Simulator records local Sale and sends documented callback fields only when stored `callBackUrl` exact origin is allowlisted.
4. At controlled callback endpoint, correlate `RefId` and `SaleOrderId` with original request. Then send `bpVerifyRequest` using matching `terminalId`, callback `SaleOrderId`, and `SaleReferenceId`.
5. On Verify result `0`, send `bpSettleRequest`; local `0` means settlement request accepted, never real deposit. Or use `bpVerifySettleRequest` after successful Sale for combined local verification/settlement request.
6. Inspect safe diagnostics at `/local`. See [Verify](docs/protocol/VERIFY.md), [Settle](docs/protocol/SETTLE.md), and [VerifySettle](docs/protocol/VERIFY_SETTLE.md) for exact local boundaries.

## Scenarios and transport faults

Transaction-scoped scenarios (`NORMAL`, `VERIFY_UNRESOLVED`, `KNOWN_REVERSED`) are deterministic local test controls, never provider behavior. One-shot Verify/Settle/VerifySettle transport profiles simulate bounded PRE/POST failures, malformed SOAP, or delay. Configure from dashboard detail page or local control APIs. See [scenarios](docs/scenarios/README.md) and [transport faults](docs/scenarios/TRANSPORT_FAULTS.md).

## Development and validation

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`test:e2e` needs Chromium; install it separately when absent: `npx playwright install chromium`.

## Documentation

Start at [documentation index](docs/README.md): [architecture](docs/ARCHITECTURE.md), [protocol/source](docs/protocol/SOURCE.md), [SOAP compatibility](docs/protocol/SOAP_COMPATIBILITY.md), [uncertainties](docs/protocol/UNCERTAINTIES.md), [scenarios](docs/scenarios/README.md), [transport faults](docs/scenarios/TRANSPORT_FAULTS.md), [dashboard](docs/DASHBOARD.md), [testing](docs/TESTING.md), [development](docs/DEVELOPMENT.md), [release readiness](docs/RELEASE_READINESS.md), and [roadmap](docs/ROADMAP.md).

## Project and license status

No license has been selected or included. Rights to use, modify, or redistribute repository content require repository-owner decision before public release. Contribution policy is not yet established; follow [development guidance](docs/DEVELOPMENT.md) for local work.
