# Development

Node.js and npm are required. This App Router project uses TypeScript strict mode, React, Tailwind CSS, and a shadcn/ui `components.json` foundation. No shadcn component is generated in Goal 1; add UI dependencies only with a concrete component need.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. This local simulator must never receive real card/PIN/CVV2/OTP credentials.

Before a change, inspect existing code and `AGENTS.md`. Derive protocol only from `docs/protocol/SOURCE.md` and linked v1.39 facts. Mark non-source behavior `SIMULATOR_INTERNAL` or `SIMULATOR_SCENARIO`; add unknowns to `docs/protocol/UNCERTAINTIES.md`.

Local SOAP service is `POST http://localhost:3000/api/soap`. It accepts only [SOAP_COMPATIBILITY.md](protocol/SOAP_COMPATIBILITY.md), not a production Behpardakht endpoint. Use fake local merchant values only.

After a successful Pay SOAP result, submit a browser form with its exact case-sensitive RefId to `POST http://localhost:3000/local/start-pay`. The local endpoint accepts URL-encoded `RefId` only, then shows fake developer payment controls. It accepts no amount, order, terminal, callback, or Sale identifier from browser action input.

Callback delivery is disabled unless `SIMULATOR_CALLBACK_ALLOWED_ORIGINS` contains an exact allowed `http:` or `https:` origin. Example for a controlled receiver: `SIMULATOR_CALLBACK_ALLOWED_ORIGINS=http://127.0.0.1:4010 npm run dev`. Explicitly configure localhost or `127.0.0.1`; neither is implicitly trusted. The local dispatcher rejects credentials in URLs, redirects, and destinations outside this allowlist.

Use no database, SOAP/XML parser, proxy, external service, or extra runtime package until needed by an approved Goal. Goal 3 uses `saxes` solely for safe, event-driven XML parsing behind `src/server/soap`.
