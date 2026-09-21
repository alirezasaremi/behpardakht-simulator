# Goal 3 local SOAP compatibility profile

This profile makes a local development simulator usable. It is not a claim of production Behpardakht wire compatibility.

## v1.39 facts (`PROTOCOL`)

- Printed source page 8: SOAP uses XML; transport is HTTP or HTTPS.
- Printed source page 12: provider test and operational WSDL URLs are listed in `SOURCE.md`.
- Printed pages 14-16: `bpPayRequest` fields, case-sensitive spellings, source types, optional fields, `additionalData` maximum 1000 characters, and `localDate` / `localTime` examples.
- Printed pages 14-17: successful Pay result example `0, AF82041a2Bf6989c7fF9`; first component is `ResCode`, second is case-sensitive `RefId`; Pay `orderId` must be unique and duplicate request returns an error.
- Printed pages 28-29 table 9: `bpDynamicPayRequest` fields/types, `subServiceId`, unique Dynamic Pay `orderId`, case-sensitive RefId, and illustrated `0,RefId` success. Source does not map a Dynamic Pay failure state to a table-11 code.
- Printed pages 30-31 table 10: `bpCumulativeDynamicPayRequest` fields/types, at most ten comma/semicolon-delimited account-id/amount/payer-id triples, total-sum constraint, unique Cumulative Dynamic Pay `orderId`, case-sensitive RefId, and illustrated `0,RefId` success. Source does not map its failure state to a table-11 code.
- Printed page 36: table 11 labels `41` “duplicate request number.” PDF does not explicitly connect this row to duplicate Pay `orderId`.
- Printed page 22 table 3: `bpSettleRequest` exact fields/types; its `0` is successful receipt of settlement request. Settle `orderId` need not be unique and may equal `saleOrderId`.
- Printed pages 31-32 table 12: `bpVerifySettleRequest` exact fields/types; its source-specific retry prose plus table 11 establish `0`, `43`, `45`, and `48`. VerifySettle `orderId` need not be unique and may equal `saleOrderId`.
- Printed pages 23-24 tables 4-5: `bpInquiryRequest` / `bpReversalRequest` exact fields/types; each returns response-code string and its `orderId` need not be unique and may equal `saleOrderId`.

## Still unspecified by v1.39

PDF does not supply WSDL schema contents, XML namespaces, SOAP version/envelope structure, request/response wrapper names, element order at XML wire level, SOAPAction rules, transport headers, malformed XML behavior, provider error-envelope shape, or provider code/result grammar for duplicate Pay `orderId`. Provider service URLs are documented, but no local endpoint is.

## Local choices (`SIMULATOR_INTERNAL`)

- Endpoint: `POST /api/soap`; never production host or proxy.
- SOAP version: SOAP 1.1 envelope namespace `http://schemas.xmlsoap.org/soap/envelope/`.
- Envelope: one SOAP `Body`, one direct operation element. Optional operation namespace/prefix is ignored; local element name must be exactly `bpPayRequest`, `bpDynamicPayRequest`, `bpCumulativeDynamicPayRequest`, `bpVerifyRequest`, `bpSettleRequest`, `bpVerifySettleRequest`, `bpInquiryRequest`, or `bpReversalRequest`.
- Supported operations: only `bpPayRequest`, safe normal-path `bpDynamicPayRequest`, safe normal-path `bpCumulativeDynamicPayRequest`, `bpVerifyRequest`, `bpSettleRequest`, `bpVerifySettleRequest`, `bpInquiryRequest`, `bpReversalRequest`.
- Response: SOAP 1.1 envelope containing matching local `Response` / `Result` wrappers. Pay/Dynamic Pay/Cumulative Dynamic Pay normal success is documented `0,RefId`; other audits are [VERIFY.md](VERIFY.md), [SETTLE.md](SETTLE.md), [VERIFY_SETTLE.md](VERIFY_SETTLE.md), [INQUIRY.md](INQUIRY.md), and [REVERSAL.md](REVERSAL.md).
- Faults: malformed/unsupported/structurally invalid input returns HTTP 400 local SOAP `Fault`, not Behpardakht `ResCode`. Internal failures return generic HTTP 500 local SOAP `Fault`.
- Goal 10 may return fixed simulator-only HTTP 503, fixed malformed XML, or fixed post-execution delay after normal input safety/correlation. These are not SOAP Faults or provider behavior; see `../scenarios/TRANSPORT_FAULTS.md`.
- Duplicate `(terminalId, orderId)`: terminal-wide Pay-family uniqueness is a `SIMULATOR_INTERNAL` ambiguity-prevention rule. Local service returns operation-specific HTTP 409 SOAP Fault; none is Behpardakht `41` or provider response code.
- No SOAPAction requirement is enforced because v1.39 does not define one.
- Decimal integer text is converted directly to `bigint`; it must use ASCII digits only. This avoids JavaScript number precision loss. No production long lexical/range claim is made.
- Local RefIds use opaque `local_` plus random UUID-derived token. They are uniqueness-checked against running repository state, case-sensitive, transport-safe, non-secret, and injectable in tests. Their format is not provider format.
- Merchant authentication/configuration, Mana brokerage category, and registered-domain lookup are not implemented. Verify/Settle/Inquiry/Reversal user credentials are structural compatibility input only and never persist/log. Goal 4 payment-page/callback behavior is separate in `START_PAY.md` and `CALLBACK.md`.
- Pay validates table-1 required normal-path fields. Source-optional `mobileNo`, `encPan`, and `enc` are rejected locally to avoid personal/card/identity data intake; `panHiddenMode` and `cartItem` are accepted then discarded. This safety boundary is `SIMULATOR_INTERNAL`, not provider acceptance behavior.
- Dynamic Pay validates table-9 required normal-path fields. Its `subServiceId` is parsed bigint-safe then discarded; no provider provisioning/payout model exists. Source-optional `mobileNo`, `encPan`, and `enc` are rejected locally to avoid personal/card/identity data. This safety boundary is `SIMULATOR_INTERNAL`, not provider acceptance behavior.
- Cumulative Dynamic Pay validates table-10 normal-path fields, one through ten documented-delimiter distributions, local ASCII-decimal bigint amounts and source total equality. Account/payer identifiers are discarded. Source-optional `mobileNo`, `encPan`, and `enc` reject locally. No account authorization, payout, provider provisioning, or final settlement is modeled.

## Input validation and XML safety

Maximum raw request size is 65,536 bytes. Bodies exceeding it are stopped before XML parsing. Service uses `saxes` event-driven parsing, rejects every DTD declaration (and DTD entity definitions), does not fetch schemas/resources, accepts no external entity resolution, limits XML depth to 32 and nodes to 256, and reports malformed XML with local fault. It uses source's 1000-character `additionalData` bound; other local field caps are simulator safety limits.

No request body, password, card-like optional input, or raw XML is logged or stored. `userPassword` is parsed only to meet documented request structure, then discarded.

## Local request example

Start development server with `npm run dev`, then send only fake local values:

```bash
curl --request POST http://localhost:3000/api/soap \
  --header 'content-type: text/xml; charset=utf-8' \
  --data-binary @- <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <bpPayRequest>
      <terminalId>9007199254740993</terminalId>
      <userName>local-merchant</userName>
      <userPassword>fake-local-password</userPassword>
      <orderId>9007199254740995</orderId>
      <amount>1000</amount>
      <localDate>20260101</localDate>
      <localTime>120000</localTime>
      <additionalData>local test order</additionalData>
      <callBackUrl>https://merchant.test/callback</callBackUrl>
      <payerId>0</payerId>
    </bpPayRequest>
  </soap:Body>
</soap:Envelope>
XML
```

Response contains local SOAP wrapper and `bpPayRequestResult` text `0,<local RefId>`. Dynamic/Cumulative normal paths use their matching result wrapper with same result shape. Goal 4 can then POST that RefId to local `/local/start-pay`; it has fake outcomes/callback only. After successful Sale, Goal 5 accepts Verify; after Verify `0`, Goal 6 accepts Settle table-3 fields and returns `0` for received request. Goal 8 accepts table-12 VerifySettle with source-backed `0`/`43`/`45`/`48` results. Goal 7 parses/correlates table-4 Inquiry and table-5 Reversal, then faults locally because v1.39 supplies no operation-specific result mapping. Goal 9 scenario control remains outside SOAP at `/local/api/scenarios`; Refund remains unimplemented.
