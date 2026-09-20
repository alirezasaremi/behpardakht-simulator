# Protocol source

## Sole authority

`PROTOCOL` facts in this repository come exclusively from supplied PDF: *Mellat PGW Technical Document v1.39* / *User Guide: Internet Payment Gateway Functions and Methods*, Behpardakht Mellat, Azar 1404, 38 pages. It identifies version 1.39 and date on its page headers.

Source page references below use printed PDF page numbers where visible (for example, PDF page 14 contains source content page 13). The document states SOAP/XML over HTTP or HTTPS at a high level, but source support must be assessed per wire-level claim.

## Method inventory (`PROTOCOL`)

- `bpPayRequest`, `bpChargePayRequest`, `bpVerifyRequest`, `bpSettleRequest`, `bpInquiryRequest`, `bpReversalRequest`.
- `bpRefundRequest`, `bpRefundRequestV2`, `bpRefundToPANRequest`.
- `bpDynamicPayRequest`, `bpCumulativeDynamicPayRequest`, `bpVerifySettleRequest`.

This inventory does not make every method an MVP. See `ROADMAP.md` for simulator scope (`SIMULATOR_INTERNAL`).

## Reading rules

Preserve identifiers, case, documented types, response codes, and short required values. Summaries do not establish missing namespaces, WSDL schemas, SOAPAction values, envelopes, serialization, or transport wire details. Record uncertainty rather than extrapolating.
