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
- Printed pages 36-37, table 11: `0` completed successfully, `43` prior Verify succeeded, and `48` reversed transaction meaning. Goal 7 combines page-21 previous-reversal Verify wording with table `48`.

## Goal 6 source locations (`PROTOCOL`)

- Printed page 22: `bpSettleRequest` purpose, response-code-string return, exact table-3 names/types, `0` successful receipt of merchant settlement request, and non-unique Settle `orderId` permitted equal to `saleOrderId`.
- Printed page 20: automatic settlement after three hours absent merchant reversal/settlement request; any StartPay `SettleTime` changes time to six hours. Goal 6 documents but does not automate these rules.
- Printed pages 23-24: Reversal timing and no settlement-request prerequisite for later Reversal; Goal 6 leaves Reversal unimplemented.
- Printed pages 36-37, table 11: global meanings include `45`, `46`, `47`, `61`; source does not expressly tie a nonzero result to `bpSettleRequest`, so Goal 6 returns none.

## Goal 7 source locations (`PROTOCOL`)

- Printed pages 10 and 13: Inquiry follows missing Verify response; Reversal follows failed Inquiry/payment uncertainty and is exceptional.
- Printed page 21: Verify retry wording expressly includes previously reversed result; successful Sale absent Verify within 20 minutes causes automatic reversal request.
- Printed pages 23-24, tables 4-5: exact Inquiry/Reversal fields/types, response-code-string returns, non-unique request `orderId` permitted equal to `saleOrderId`, Inquiry purpose, Reversal-after-Verify purpose, three-hour reverse announcement, and end-of-current-day/no-settlement rule. Neither section maps `0` or other code to operation outcome.
- Printed pages 36-37, table 11: `0` completed successfully and `48` reversed transaction. `0` table entry alone is not Inquiry/Reversal mapping. Page 21 plus table 11 makes `48` Verify-specific after known reversed state; table alone does not establish Reversal retry behavior.

## Goal 8 source locations (`PROTOCOL`)

- Printed pages 10 and 31-32: combined Verify/Settle purpose, exact `bpVerifySettleRequest` table-12 fields/types, response-code-string return, callback/`ResCode` workflow, non-unique `orderId` permitted equal to `saleOrderId`, and 20-minute automatic-reversal statement after successful Sale without VerifySettle.
- Printed page 32: `0` successful payment-page transaction and use of VerifySettle for bank-side verification/settlement; repeated VerifySettle wording expressly names success, previous Verify, previous Settle, and previous Reversal.
- Printed pages 35-36 table 11: maps named retry states to `0`, `43`, `45`, and `48`. This mapping is enabled only because page 32 directly ties those state names to VerifySettle.

## Goal 12 source locations (`PROTOCOL`)

- Printed pages 9-10: names Dynamic Pay and says later confirmation, settlement, reversal, and inquiry follow Pay-like flow.
- Printed pages 28-29 table 9: exact `bpDynamicPayRequest` fields/types, `subServiceId`, optional fields, 1000-character `additionalData`, unique Dynamic Pay request number, case-sensitive RefId, and illustrated `0,RefId`/POST next stage.
- Printed pages 24-28 tables 6-8: Refund request variants, constraints and response examples; final state depends on refund inquiry services not supplied in this PDF.
- Printed pages 14-20 and 30-31: Charge, redirect-specialized and cumulative Dynamic Pay evidence. See [remaining protocol audit](REMAINING_PROTOCOL_AUDIT.md) for exact inventory and withheld assumptions.

## Goal 13 source locations (`PROTOCOL`)

- Printed pages 24-27, tables 6-7: Refund `0` is initial acceptance only; final result and retry safety require separately documented refund-inquiry services. The separate document is absent from the local official-source inventory.
- Printed page 18: Charge `additionalData` structure names direct TopUp mobile data or Voucher operator/serial service data. It does not establish safe charge fulfilment.
- Printed page 20: any `SettleTime` string changes automatic settlement from 180 to 360 minutes, but does not reconcile automatic settlement with explicit Settle or Reversal.
- Printed pages 10 and 30-31, table 10: exact Cumulative Dynamic Pay operation, fields/types, up-to-ten delimited account/amount/payer triples, total-sum constraint, unique request-number statement, illustrated `0,RefId`, RefId POST, and Pay-like later workflow.

## Reading rules

Preserve identifiers, case, documented types, response codes, and short required values. Summaries do not establish missing namespaces, WSDL schemas, SOAPAction values, envelopes, serialization, or transport wire details. Record uncertainty rather than extrapolating.
