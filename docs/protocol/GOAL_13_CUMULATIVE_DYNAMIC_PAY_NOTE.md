# Goal 13 implementation note: `bpCumulativeDynamicPayRequest`

## Selected capability and source

Goal 13 selects one `SAFE_PARTIAL` slice: the normal, structurally documented path of `bpCumulativeDynamicPayRequest`.

`DOCUMENTED / PROTOCOL` evidence is v1.39 printed pages 10 and 30-31, table 10:

- the exact operation name and its Pay-like purpose;
- all table-10 request fields and types;
- one total payment distributed to several merchant-requested payout accounts;
- `additionalData` with at most ten account-id, amount, payer-id triples, comma-separated within a triple and semicolon-separated between triples;
- the total payment amount equals the sum of distribution amounts;
- illustrated `0,RefId` success and POST of `RefId` after `0`;
- a unique cumulative Type Two payment request number and case-sensitive `RefId`.

The PDF's reference to table 3 for the response is an apparent document error. It does not supply a Cumulative-Dynamic-Pay-specific nonzero result mapping.

## Implemented boundary

The local SOAP compatibility endpoint accepts table-10 normal-path fields, validates one through ten delimited triples, validates each distribution amount as a local canonical decimal integer, and checks its bigint sum against table-10 `amount`. It accepts an empty payer-id and one terminal semicolon because table 10's example shows both. Account identifiers and payer identifiers are used only while parsing and are discarded before transaction creation.

Successful input creates the existing safe local Pay-family transaction, records `paymentOperation: "CUMULATIVE_DYNAMIC_PAY"`, assigns an opaque local RefId, and returns documented normal result `0,RefId`. Existing local StartPay/Sale/callback and later-operation reuse is `DERIVED`: printed page 10 says confirmation, settlement, reversal, and inquiry follow the Pay process, but it does not restate their wire details.

Existing terminal-wide Pay-family `{ terminalId, orderId }` uniqueness remains `SIMULATOR_INTERNAL`. A duplicate returns a local SOAP Fault, never provider result `41`.

## Intentional omissions

The slice does not simulate account provisioning or authorization, payout distribution, settlement/deposit completion, account balance movement, provider credential authentication, or provider nonzero results. It adds no timers, scenarios, transport faults, or new lifecycle state/event.

Source does not define all lexical details. Whitespace rules, account-id format, payer-id format, negative/zero amount eligibility, and provider error mappings remain `UNSPECIFIED`. The local parser accepts only its documented-delimiter, ASCII-decimal normal profile and raises a local validation Fault outside it; that Fault makes no provider claim.

## Security boundary

`mobileNo`, `encPan`, and `enc` are rejected. No PAN, destination PAN, PIN, CVV2, OTP, mobile number, national identity, encryption/key material, password, callback URL, raw SOAP, account identifier, or payer identifier is stored, logged, rendered, included in events, or exposed by dashboard DTOs. `userName` and `userPassword` remain structural compatibility inputs and are discarded.

`panHiddenMode` and `cartItem` are accepted as table-10 optional values then discarded. Neither enables card handling or payment-page display behavior.

## Classifications

- `DOCUMENTED / PROTOCOL`: operation name, table-10 fields/types, ten-entry maximum, delimiters, total-sum constraint, normal `0,RefId`, RefId POST, request uniqueness statement, and Pay-like later workflow.
- `DERIVED`: existing local StartPay/Sale/callback and later SOAP plumbing may serve this Pay-like transaction.
- `SIMULATOR_INTERNAL`: local SOAP shape, bounded parser, ASCII-decimal profile, terminal-wide identity invariant, opaque identifiers, immutable aggregate, local Faults, and dashboard operation label.
- `SIMULATOR_SCENARIO`: none added.
- `UNSPECIFIED`: provider WSDL/envelope/SOAPAction, authentication, provisioning, exact lexical grammar outside normal profile, nonzero outcomes, payout/settlement execution, retry behavior beyond the unique request-number statement, timing, and financial finality.
