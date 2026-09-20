# Roadmap

1. Goal 1: foundation, guardrails, docs, tooling.
2. Goal 2: transaction domain and state model. Complete: immutable domain aggregate, transition/event rules, clock, and in-memory repository.
3. Goal 3: SOAP foundation and `bpPayRequest`. Complete: local SOAP compatibility profile, safe XML intake, documented Pay fields/result, local RefId generation, and Goal 2 repository integration. No payment page or callback.
4. Goal 4: fake payment page and callback. Complete: local StartPay POST, fake success/non-success Sale, simulator SaleReferenceId, safe callback payload/dispatch, SSRF boundary, browser lifecycle.
5. Goal 5: `bpVerifyRequest`. Complete: local SOAP table-2 adapter, bigint-safe complete Sale correlation, successful verification, documented already-verified result, and response audit. No timer, Reversal, Settle, Inquiry, VerifySettle, or scenario engine.
6. Goal 6: `bpSettleRequest`.
7. Goal 7: `bpInquiryRequest` and `bpReversalRequest`.
8. Goal 8: `bpVerifySettleRequest`.
9. Goal 9: deterministic scenario engine.
10. Goal 10: transport/protocol fault injection.
11. Goal 11: developer dashboard.
12. Goal 12+: specialized documented operations: `bpChargePayRequest`, `bpRefundRequest`, `bpRefundRequestV2`, `bpRefundToPANRequest`, `bpDynamicPayRequest`, and `bpCumulativeDynamicPayRequest`.

Initial intended implementation scope is `bpPayRequest`, payment-page redirect, callback, `bpVerifyRequest`, and `bpSettleRequest`; then Inquiry, Reversal, and VerifySettle. This prioritization is `SIMULATOR_INTERNAL`, not a claim all documented methods are MVP operations.
