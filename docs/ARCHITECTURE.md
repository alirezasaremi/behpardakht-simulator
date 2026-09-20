# Architecture

## Status

This is an intended future architecture, not Goal 1 implementation. `SIMULATOR_INTERNAL` choices below must never be presented as Behpardakht protocol.

## Boundaries

```text
Client
  -> SOAP/protocol boundary
  -> Behpardakht application service
  -> transaction state machine
  -> replaceable in-memory transaction repository

Payment browser
  -> fake payment page
  -> controlled simulated result
  -> allowlisted callback dispatcher
  -> client callback

Separate: scenario engine, developer dashboard
```

Future server modules: `src/server/protocol`, `src/server/soap`, `src/server/transactions`, `src/server/callbacks`, `src/server/scenarios`, and `src/server/security`.

## Non-negotiable security architecture

No real PAN, PIN, CVV2, OTP, banking credential, or secret belongs in UI, logs, storage, fixtures, or source control. Callback destinations need explicit allowlisting, URL parsing/validation, SSRF defense, bounded time/response size, and no blind redirect following. SOAP/XML intake needs size bounds, input validation, safe parsing, and DTD/external-entity/entity-expansion rejection. Diagnostics must be safely rendered. No generic arbitrary HTTP-request feature.

## Deferred decisions

`SIMULATOR_INTERNAL`: initial persistence will be in-memory and replaceable. Database/persistence, authentication, dashboard, scenario engine, SOAP transport, and payment lifecycle are deferred. Exact WSDL/envelope/serialization choices remain unspecified until source support is established.
