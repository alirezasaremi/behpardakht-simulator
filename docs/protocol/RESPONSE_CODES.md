# Response codes

`PROTOCOL`: v1.39 table 11. English labels below are concise translations, not reinterpretations. Numeric codes preserved. Source-specific explanatory conditions remain noted where relevant.

| Code | Source meaning |
| ---: | --- |
| 0 | Transaction completed successfully. |
| 11 | Invalid card number. |
| 12 | Insufficient funds; for refund, insufficient merchant credit. |
| 13 | Incorrect password. |
| 14 | Password entry attempts exceeded permitted limit. |
| 15 | Invalid card. |
| 16 | Withdrawal attempts exceeded permitted limit. |
| 17 | Cardholder cancelled transaction. |
| 18 | Card expired. |
| 19 | Withdrawal amount exceeds permitted limit; for refund, requested refunds exceed original purchase amount. |
| 20 | Merchant did not send customer-authentication parameters. |
| 21 | Invalid merchant; service not active for merchant. |
| 23 | Security error. |
| 24 | Invalid merchant credentials. |
| 25 | Invalid amount. |
| 26 | Institution cannot send request. |
| 27 | Device cannot perform requested transaction. |
| 28 | Device cannot respond now. |
| 29 | Store cannot perform requested transaction. |
| 30 | Previous request is in progress. |
| 31 | Invalid response. |
| 32 | Entered data format is invalid. |
| 33 | Invalid account. |
| 34 | System error. |
| 35 | Invalid date. |
| 36 | Sender institution, Shaparak, or transaction destination is Sign Off. |
| 37 | Payment service provider or Shaparak is Sign Off. |
| 38 | Key-change process for issuer or merchant is in progress. |
| 39 | Shaparak cannot respond. |
| 41 | Duplicate request number. |
| 42 | Sale transaction not found; for refund, matching successful purchase does not exist. |
| 43 | Verify request already made; source says prior verification succeeded and merchant can regard transaction successful. |
| 44 | Verify request not found. |
| 45 | Transaction settled; source says prior settlement succeeded and merchant can regard transaction successful. |
| 46 | Transaction not settled. |
| 47 | Settle transaction not found. |
| 48 | Transaction reversed; source says merchant or automatic reversal returned funds to cardholder. |
| 51 | Duplicate transaction. |
| 54 | Reference transaction does not exist. |
| 55 | Invalid transaction. |
| 56 | Cardholder ownership verification (Mana) error. |
| 57 | Cardholder identity inquiry (strong authentication) error. |
| 61 | Settlement error. |
| 62 | Return route is outside merchant registered domain; callback route must be in registered domain. |
| 98 | Static-password usage limit reached. |
| 111 | Invalid card issuer. |
| 112 | Card-issuer switch error. |
| 113 | No response received from destination system. |
| 114 | Cardholder is not allowed to perform transaction. |
| 115 | You are not allowed to perform transaction. |
| 116 | Card issuer cannot respond. |
| 117 | Card issuer cannot respond now. |
| 211 | Transaction cannot currently be performed by this device. |
| 412 | Invalid bill identifier. |
| 413 | Invalid payment identifier. |
| 414 | Invalid bill-issuing organization. |
| 415 | Work-session time ended. |
| 416 | Error recording information. |
| 417 | Invalid payer identifier. |
| 418 | Problem defining customer information. |
| 419 | Information-entry attempts exceeded permitted limit. |
| 421 | Invalid IP; merchant server IP was not declared to system. |
| 995 | Bank-card ownership by customer not verified. |
| 997 | Destination system inactive. |

## Goal 5 Verify response audit

Only `0` and `43` are returned by `bpVerifyRequest`. `0` is returned after Goal 5 confirms a fully correlated successful Sale; `43` is returned for same transaction after confirmed Verify. Both mappings have direct basis in printed pages 21, 36, and 37; state mutation is `SIMULATOR_INTERNAL`. `48` is not returned because current model has no completed reversal; `42` is not returned because its explicit matching-Sale explanation is refund-specific. All malformed, unsupported, mismatched, unknown, and non-modeled Verify cases remain local SOAP faults. See [VERIFY.md](VERIFY.md).

## Goal 6 Settle response audit

Only `0` returns from `bpSettleRequest`: printed page 22 says it means merchant settlement request received successfully. Correlated verified local Sale records settlement request; state recording is `SIMULATOR_INTERNAL`. No nonzero code returns: table-11 `45`, `46`, `47`, and `61` lack explicit `bpSettleRequest` applicability in source. Repeated, pre-Verify, unknown, mismatched, malformed, and unsupported Settle requests are local SOAP Faults. See [SETTLE.md](SETTLE.md).
