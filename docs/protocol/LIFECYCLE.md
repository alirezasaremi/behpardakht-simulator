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
- Retrying Verify after nonzero callback `ResCode` is described until response indicates success, previously verified, or previously reversed. VerifySettle also adds previously settled. Catalogue codes include `43` already Verify requested, `45` settled, and `48` reversed.

## Simulator decisions

No state machine or timer exists in Goal 1. Later representation of clocks, retry limits, callback dispatch, and state transition mechanics is `SIMULATOR_INTERNAL`; test-controlled timing/outcomes are `SIMULATOR_SCENARIO`.
