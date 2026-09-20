# Lifecycle

## Documented path (`PROTOCOL`)

```text
Pay
  -> payment page / Sale
  -> POST callback
  -> Verify
  -> Settle
```

Merchant may use `bpVerifySettleRequest` for combined Verify/Settle, or Verify then leave settlement to Behpardakht per source description. `bpInquiryRequest` is for missing/unknown Verify outcome. `bpReversalRequest` is exceptional: merchant cannot determine payment status, including after Inquiry, withholds goods/services, and asks reversal.

## Timing and repeated states (`PROTOCOL`)

- Successful Sale needs `bpVerifyRequest` within 20 minutes or gateway sends automatic reversal request; document says funds return to cardholder. Same 20-minute rule appears for `bpVerifySettleRequest`.
- `bpReversalRequest` must follow `bpVerifyRequest`; latest reverse request time is 3 hours after Verify. Source says debited funds return by end of same day if settlement request was not sent.
- Default automatic settlement: after 3 hours (180 minutes), for successful transactions without reversal or settlement request, Behpardakht sends settlement on merchant's behalf.
- When redirect POST includes `SettleTime` with any string value alongside `RefId`, source says settlement time changes to 6 hours (360 minutes).
- Retrying Verify after nonzero callback `ResCode` is described until response indicates success, previously verified, or previously reversed. VerifySettle also adds previously settled. Catalogue codes include `43`, `45`, `48`; `45` catalogue wording alone does not establish `bpSettleRequest` retry behavior. Callback `ResCode` is not Verify result.

## Simulator decisions

Goal 4 adds local StartPay lookup and fake user-selected Sale results. `SUCCESS` records documented callback `ResCode` `0`; Goal 4's only `NON_SUCCESS` choice records documented table-11 code `17` (user/cardholder cancellation). Choosing this single outcome is `SIMULATOR_SCENARIO`, not a model of provider failure mechanics. `PROTOCOL`: both paths use original Pay `orderId` as callback `SaleOrderId`; generated numeric `SaleReferenceId` is simulator-only.

Callback dispatch appends attempted plus delivered/failed diagnostic events. Delivery failure does not change `SUCCEEDED` or `NON_SUCCESS`, create a provider ResCode, retry, verify, settle, or reverse anything.

Goal 5 implements local SOAP Verify for a correlated successful Sale. It records `VERIFY_ATTEMPTED`, then `VERIFICATION_CONFIRMED`, yields `VERIFIED`, preserves `SUCCEEDED` Sale and `NOT_REQUESTED` settlement, and returns provider code `0`. A later Verify returns `43` without a new event. Complete correlation is `{ terminalId, saleOrderId, saleReferenceId }`; local Verify `orderId` is neither lookup key nor unique.

Goal 6 accepts local SOAP Settle only after correlated `VERIFIED` state. It appends `SETTLEMENT_REQUESTED` with `via: "SETTLE"`, preserves Sale/Verify, sets settlement `REQUESTED`, and returns `0` for received settlement request. This state labels simulator protocol lifecycle, not actual merchant deposit. Repeated/pre-Verify/correlation failures are local no-mutation Faults because source lacks operation-specific nonzero mapping. No timer performs default three-hour or `SettleTime` six-hour automatic settlement.

Goal 2 adds no timer. Its `SIMULATOR_INTERNAL` model records Sale, verification, settlement, and reversal request facts with constrained transitions and append-only events. `VERIFY_ATTEMPTED` represents a future Verify invocation with unresolved outcome; repeated Verify attempts append more `VERIFY_ATTEMPTED` events until a confirmed result, reversal request, or settlement request. `VERIFIED` represents a later confirmed result. Inquiry adds a diagnostic event without changing lifecycle state.

Nonzero callback `ResCode` is recorded as `NON_SUCCESS`, not a final failed-payment assertion: v1.39 documents another Verify call for nonzero callback results. Combined VerifySettle remains limited to the documented successful-Sale path.

`recordVerifySettleRequested` records one accepted combined result as verified plus settlement-requested. `recordReversalRequested` requires a prior Verify attempt and no settlement request, but does not claim provider acceptance or execute reversal. Exact provider eligibility after an unresolved Verify response remains an uncertainty.

`SystemClock` and `ManualClock` exist for later timing tests. They do not run the documented 20-minute/3-hour/6-hour rules, schedule jobs, or create automatic outcomes. Test-controlled timing/outcomes remain `SIMULATOR_SCENARIO`.
