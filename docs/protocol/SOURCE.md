# Protocol source

## Sole authority

`PROTOCOL` facts in this repository come exclusively from supplied PDF: *Mellat PGW Technical Document v1.39* / *User Guide: Internet Payment Gateway Functions and Methods*, Behpardakht Mellat, Azar 1404, 38 pages. It identifies version 1.39 and date on its page headers.

Source page references below use printed PDF page numbers where visible (for example, PDF page 14 contains source content page 13). The document states SOAP/XML over HTTP or HTTPS at a high level, but source support must be assessed per wire-level claim.

## Transport and service locations (`PROTOCOL`)

Source printed pages 8 and 12 state Web Services with SOAP/XML over HTTP or HTTPS. Printed page 12 lists these provider WSDL locations:

- Test: `https://pgw.dev.bpmellat.ir/pgwchannel/services/pgw?wsdl`
- Operational: `https://bpm.shaparak.ir/pgwchannel/services/pgw?wsdl`

Supplied PDF names WSDL URLs but does not include fetched schema or specify SOAP namespace, SOAPAction, envelope layout, request/response wrapper elements, or serialization. They are not evidence for simulator local endpoint details.

## Method inventory (`PROTOCOL`)

- `bpPayRequest`, `bpChargePayRequest`, `bpVerifyRequest`, `bpSettleRequest`, `bpInquiryRequest`, `bpReversalRequest`.
- `bpRefundRequest`, `bpRefundRequestV2`, `bpRefundToPANRequest`.
- `bpDynamicPayRequest`, `bpCumulativeDynamicPayRequest`, `bpVerifySettleRequest`.

This inventory does not make every method an MVP. See `ROADMAP.md` for simulator scope (`SIMULATOR_INTERNAL`).

## Reading rules

Preserve identifiers, case, documented types, response codes, and short required values. Summaries do not establish missing namespaces, WSDL schemas, SOAPAction values, envelopes, serialization, or transport wire details. Record uncertainty rather than extrapolating.
