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

## Goal 4 source locations (`PROTOCOL`)

- Printed page 14: successful Pay sends case-sensitive generated `RefId` by POST; test/operational StartPay URLs are printed.
- Printed pages 18-20: illustrated StartPay fields `MobileNo`, `EncPan`, `HiddenMode`, `merchantName`, `merchantAddress`, `GamBonds`, and `SettleTime`; `SettleTime` changes documented automatic settlement timing.
- Printed pages 21 and 32: successful Sale needs Verify/VerifySettle within 20 minutes or source describes automatic reversal.
- Printed pages 32-33: after banking operation, gateway POSTs callback fields and merchant must correlate `RefId` and `SaleOrderId` to Pay before Verify.

## Goal 5 source locations (`PROTOCOL`)

- Printed page 21: `bpVerifyRequest` purpose, response-code-string return, exact table-2 parameters/types, callback `ResCode` `0` relationship, nonzero-callback retry wording, non-unique Verify `orderId`, and 20-minute automatic-reversal statement.
- Printed pages 36-37, table 11: `0` completed successfully, `43` prior Verify succeeded, and `48` reversed transaction meaning. Page 21 names previously reversed but does not connect a local completed-reversal implementation to response `48`.

## Goal 6 source locations (`PROTOCOL`)

- Printed page 22: `bpSettleRequest` purpose, response-code-string return, exact table-3 names/types, `0` successful receipt of merchant settlement request, and non-unique Settle `orderId` permitted equal to `saleOrderId`.
- Printed page 20: automatic settlement after three hours absent merchant reversal/settlement request; any StartPay `SettleTime` changes time to six hours. Goal 6 documents but does not automate these rules.
- Printed pages 23-24: Reversal timing and no settlement-request prerequisite for later Reversal; Goal 6 leaves Reversal unimplemented.
- Printed pages 36-37, table 11: global meanings include `45`, `46`, `47`, `61`; source does not expressly tie a nonzero result to `bpSettleRequest`, so Goal 6 returns none.

## Reading rules

Preserve identifiers, case, documented types, response codes, and short required values. Summaries do not establish missing namespaces, WSDL schemas, SOAPAction values, envelopes, serialization, or transport wire details. Record uncertainty rather than extrapolating.
