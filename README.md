# Unofficial Behpardakht Payment Gateway Simulator

Local-only development simulator. It never processes real payments. Never enter a real PAN, PIN, CVV2, OTP, or banking credential.

Protocol facts are derived only from supplied Behpardakht Mellat Internet Payment Gateway guide v1.39 (Azar 1404). Read [AGENTS.md](AGENTS.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) before changing code.

Goal 3 provides one local-only SOAP endpoint: `POST /api/soap`, supporting only `bpPayRequest`. Its envelope, endpoint, and fault profile are simulator choices because v1.39 does not specify those wire details. See [SOAP compatibility profile](docs/protocol/SOAP_COMPATIBILITY.md). Use fake local merchant values only.

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```
