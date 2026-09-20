# Unofficial Behpardakht Payment Gateway Simulator

Local-only development simulator. It never processes real payments. Never enter a real PAN, PIN, CVV2, OTP, or banking credential.

Protocol facts are derived only from supplied Behpardakht Mellat Internet Payment Gateway guide v1.39 (Azar 1404). Read [AGENTS.md](AGENTS.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) before changing code.

Goal 5 adds documented `bpVerifyRequest` through same local SOAP endpoint. After successful Sale/callback, merchant sends table-2 Verify fields and receives `0`; repeated verified call receives `43`. Verify does not Settle or send another callback. See [Verify](docs/protocol/VERIFY.md), [StartPay](docs/protocol/START_PAY.md), and [Callback](docs/protocol/CALLBACK.md).

Callbacks are blocked by default. For a controlled local receiver, start server with an explicit exact-origin allowlist, for example `SIMULATOR_CALLBACK_ALLOWED_ORIGINS=http://127.0.0.1:4010 npm run dev`. Do not allow arbitrary hosts. No real card information belongs in SOAP, browser forms, logs, or callback payloads.

## Minimal local walkthrough

1. Send fake `bpPayRequest` values to `POST /api/soap` as documented in [SOAP compatibility](docs/protocol/SOAP_COMPATIBILITY.md), then extract `RefId` from `0,RefId`.
2. Submit a browser form to local endpoint only:

```html
<form action="http://localhost:3000/local/start-pay" method="post">
  <input type="hidden" name="RefId" value="local_example_refid">
  <button type="submit">Open fake local payment page</button>
</form>
```

3. Choose fake success or cancellation. Simulator records Sale, then POSTs callback fields to original stored `callBackUrl` only when destination is explicitly allowlisted.
4. Merchant must correlate callback `RefId` and `SaleOrderId` to original Pay request, then call `bpVerifyRequest` with callback `SaleOrderId` / `SaleReferenceId` and matching `terminalId`. Verify request `orderId` is separate, non-unique, and may equal `saleOrderId`.

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```
