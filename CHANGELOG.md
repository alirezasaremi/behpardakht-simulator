# Changelog

All notable release changes appear here. This project follows a simple Keep a Changelog-style format.

## [0.1.0] - 2026-09-21

### Added

- Local core Pay, Dynamic Pay, and Cumulative Dynamic Pay normal paths.
- Fake local StartPay, Sale page, callback, Verify, Settle, and VerifySettle flows.
- Conservative Inquiry/Reversal request boundaries where source result mappings are incomplete.
- Deterministic semantic scenarios and bounded one-shot transport faults.
- Local developer dashboard with safe diagnostic DTOs and existing bounded controls.
- XML/input safety, callback allowlisting, protocol-source records, uncertainty ledger, tests, and release-readiness documentation.

### Limitations

- No real payment, credential handling, bank action, provider WSDL compatibility, merchant authentication, persistence, timer, Refund, Charge, payout, or deployment behavior.
- `bpInquiryRequest` and `bpReversalRequest` do not fabricate provider results.
- The official Mellat PGW technical PDF is not distributed; the MIT License applies only to this repository's own source code and documentation.
