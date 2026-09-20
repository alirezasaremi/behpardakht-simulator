# Development

Node.js and npm are required. This App Router project uses TypeScript strict mode, React, Tailwind CSS, and a shadcn/ui `components.json` foundation. No shadcn component is generated in Goal 1; add UI dependencies only with a concrete component need.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. This local simulator must never receive real card/PIN/CVV2/OTP credentials.

Before a change, inspect existing code and `AGENTS.md`. Derive protocol only from `docs/protocol/SOURCE.md` and linked v1.39 facts. Mark non-source behavior `SIMULATOR_INTERNAL` or `SIMULATOR_SCENARIO`; add unknowns to `docs/protocol/UNCERTAINTIES.md`.

Use no database, SOAP/XML parser, proxy, external service, or extra runtime package until needed by an approved Goal.
