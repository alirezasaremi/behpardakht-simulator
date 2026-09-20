import { describe, expect, it } from "vitest";
import {
  ManualClock,
  InMemoryTransactionRepository,
  SequenceIdentifierGenerator,
} from "@/server/transactions";
import type { RefIdGenerator } from "@/server/protocol";
import { recordReversalCompleted, recordSaleSucceeded, recordVerifyAttempted } from "@/server/transactions";
import { MAX_SOAP_REQUEST_BYTES } from "./xml";
import { createLocalSoapService } from "./service";

class FixedRefIdGenerator implements RefIdGenerator {
  private sequence = 0;

  nextRefId(): string {
    this.sequence += 1;
    return `LocalRef-Aa${this.sequence}`;
  }
}

function createService() {
  const repository = new InMemoryTransactionRepository();
  return {
    repository,
    service: createLocalSoapService({
      repository,
      clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")),
      identifiers: new SequenceIdentifierGenerator(),
      refIds: new FixedRefIdGenerator(),
    }),
  };
}

function request(xml: string): Request {
  return new Request("http://local.test/api/soap", {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8" },
    body: xml,
  });
}

function payXml(overrides: Record<string, string> = {}): string {
  const fields = {
    terminalId: "9007199254740993",
    userName: "local-merchant",
    userPassword: "fake-test-password",
    orderId: "9007199254740995",
    amount: "1000",
    localDate: "20260101",
    localTime: "120000",
    additionalData: "local order",
    callBackUrl: "https://merchant.test/callback",
    payerId: "0",
    ...overrides,
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <pay:bpPayRequest xmlns:pay="urn:local-client">
      ${Object.entries(fields)
        .map(([name, value]) => `<pay:${name}>${value}</pay:${name}>`)
        .join("")}
    </pay:bpPayRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function verifyXml(overrides: Record<string, string> = {}): string {
  const fields = {
    terminalId: "9007199254740993",
    userName: "local-merchant",
    userPassword: "fake-test-password",
    orderId: "9007199254740995",
    saleOrderId: "9007199254740995",
    saleReferenceId: "9007199254740999",
    ...overrides,
  };
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpVerifyRequest>${Object.entries(fields)
    .map(([name, value]) => `<${name}>${value}</${name}>`)
    .join("")}</bpVerifyRequest></soap:Body></soap:Envelope>`;
}

function settleXml(overrides: Record<string, string> = {}): string {
  const fields = {
    terminalId: "9007199254740993",
    userName: "local-merchant",
    userPassword: "fake-test-password",
    orderId: "9007199254740995",
    saleOrderId: "9007199254740995",
    saleReferenceId: "9007199254740999",
    ...overrides,
  };
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpSettleRequest>${Object.entries(fields)
    .map(([name, value]) => `<${name}>${value}</${name}>`)
    .join("")}</bpSettleRequest></soap:Body></soap:Envelope>`;
}

function verifySettleXml(overrides: Record<string, string> = {}): string {
  const fields = {
    terminalId: "9007199254740993",
    userName: "local-merchant",
    userPassword: "fake-test-password",
    orderId: "9007199254740995",
    saleOrderId: "9007199254740995",
    saleReferenceId: "9007199254740999",
    ...overrides,
  };
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpVerifySettleRequest>${Object.entries(fields)
    .map(([name, value]) => `<${name}>${value}</${name}>`)
    .join("")}</bpVerifySettleRequest></soap:Body></soap:Envelope>`;
}

function inquiryXml(overrides: Record<string, string> = {}): string {
  const fields = {
    terminalId: "9007199254740993",
    userName: "local-merchant",
    userPassword: "fake-test-password",
    orderId: "9007199254740995",
    saleOrderId: "9007199254740995",
    saleReferenceId: "9007199254740999",
    ...overrides,
  };
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpInquiryRequest>${Object.entries(fields)
    .map(([name, value]) => `<${name}>${value}</${name}>`)
    .join("")}</bpInquiryRequest></soap:Body></soap:Envelope>`;
}

function reversalXml(overrides: Record<string, string> = {}): string {
  const fields = {
    terminalId: "9007199254740993",
    userName: "local-merchant",
    userPassword: "fake-test-password",
    orderId: "9007199254740995",
    saleOrderId: "9007199254740995",
    saleReferenceId: "9007199254740999",
    ...overrides,
  };
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpReversalRequest>${Object.entries(fields)
    .map(([name, value]) => `<${name}>${value}</${name}>`)
    .join("")}</bpReversalRequest></soap:Body></soap:Envelope>`;
}

function saveUnresolvedVerify(repository: InMemoryTransactionRepository): string {
  const paid = repository.getByRefId("LocalRef-Aa1");
  if (paid === undefined) {
    throw new Error("Pay fixture did not create transaction.");
  }
  const clock = new ManualClock(new Date("2026-01-01T00:00:01.000Z"));
  const identifiers = new SequenceIdentifierGenerator();
  return repository.save(
    recordVerifyAttempted(
      recordSaleSucceeded(
        paid,
        { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
        clock,
        identifiers,
      ),
      clock,
      identifiers,
    ),
  ).id;
}

describe("LocalSoapService", () => {
  it("handles supported SOAP bpPayRequest and persists protocol correlation without password", async () => {
    const { repository, service } = createService();
    const response = await service.handle(request(payXml()));
    const body = await response.text();
    const transaction = repository.getByTerminalIdAndOrderId(
      BigInt("9007199254740993"),
      BigInt("9007199254740995"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/xml");
    expect(body).toContain("<soap:Envelope");
    expect(body).toContain("<bpPayRequestResponse>");
    expect(body).toContain("<bpPayRequestResult>0,LocalRef-Aa1</bpPayRequestResult>");
    expect(transaction).toMatchObject({
      terminalId: BigInt("9007199254740993"),
      orderId: BigInt("9007199254740995"),
      amount: BigInt(1_000),
      callBackUrl: "https://merchant.test/callback",
      refId: "LocalRef-Aa1",
    });
    expect("userPassword" in (transaction ?? {})).toBe(false);
  });

  it("returns local duplicate fault while allowing same orderId for another terminal", async () => {
    const { service } = createService();
    await service.handle(request(payXml()));
    const duplicate = await service.handle(request(payXml()));
    const otherTerminal = await service.handle(request(payXml({ terminalId: "9007199254740994" })));

    expect(duplicate.status).toBe(409);
    expect(await duplicate.text()).toContain("<faultcode>Client.DuplicatePayOrderId</faultcode>");
    expect(await otherTerminal.text()).toContain("<bpPayRequestResult>0,LocalRef-Aa2</bpPayRequestResult>");
  });

  it("rejects malformed XML, unsupported operations, invalid longs, and missing required input as local faults", async () => {
    const { service } = createService();
    const malformed = await service.handle(request("<soap:Envelope>"));
    const unsupported = await service.handle(request(payXml().replaceAll("bpPayRequest", "bpVerifyRequest")));
    const invalidLong = await service.handle(request(payXml({ orderId: "9007199254740995.5" })));
    const missingRequired = await service.handle(request(payXml().replace(/<pay:payerId>0<\/pay:payerId>/, "")));

    for (const response of [malformed, unsupported, invalidLong, missingRequired]) {
      expect(response.status).toBe(400);
      expect(await response.text()).toContain("<soap:Fault>");
    }
  });

  it("rejects DTD/entity input and oversized request bodies before service dispatch", async () => {
    const { service } = createService();
    const dtd = await service.handle(
      request(`<!DOCTYPE soapenv:Envelope [<!ENTITY value "expanded">]>${payXml({ additionalData: "&value;" })}`),
    );
    const oversized = await service.handle(request("x".repeat(MAX_SOAP_REQUEST_BYTES + 1)));

    expect(dtd.status).toBe(400);
    expect(await dtd.text()).toContain("DTD declarations are not allowed.");
    expect(oversized.status).toBe(400);
    expect(await oversized.text()).toContain("SOAP request exceeds local size limit.");
  });

  it("enforces documented additionalData maximum and does not accept unsafe numeric syntax", async () => {
    const { service } = createService();
    const tooLong = await service.handle(request(payXml({ additionalData: "x".repeat(1_001) })));
    const exponent = await service.handle(request(payXml({ amount: "1e3" })));

    expect(tooLong.status).toBe(400);
    expect(exponent.status).toBe(400);
  });

  it("runs Pay-to-Sale-to-Verify through local SOAP boundary without settling", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const paid = repository.getByRefId("LocalRef-Aa1");
    if (paid === undefined) {
      throw new Error("Pay fixture did not create transaction.");
    }
    const sold = repository.save(
      recordSaleSucceeded(
        paid,
        { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
        new ManualClock(new Date("2026-01-01T00:00:01.000Z")),
        new SequenceIdentifierGenerator(),
      ),
    );

    const verified = await service.handle(request(verifyXml()));
    const verifiedBody = await verified.text();
    const repeated = await service.handle(request(verifyXml()));

    expect(verified.status).toBe(200);
    expect(verifiedBody).toContain("<bpVerifyRequestResult>0</bpVerifyRequestResult>");
    // PROTOCOL: table 11 code 43 means prior successful Verify.
    expect(await repeated.text()).toContain("<bpVerifyRequestResult>43</bpVerifyRequestResult>");
    expect(repository.getById(sold.id)).toMatchObject({
      saleState: "SUCCEEDED",
      verificationState: "VERIFIED",
      settlementState: "NOT_REQUESTED",
    });
  });

  it("keeps malformed or non-correlating Verify requests local faults with no mutation", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const paid = repository.getByRefId("LocalRef-Aa1");
    if (paid === undefined) {
      throw new Error("Pay fixture did not create transaction.");
    }
    const clock = new ManualClock(new Date("2026-01-01T00:00:01.000Z"));
    const identifiers = new SequenceIdentifierGenerator();
    const sold = repository.save(
      recordSaleSucceeded(
        paid,
        { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
        clock,
        identifiers,
      ),
    );

    const malformed = await service.handle(request(verifyXml({ saleOrderId: "not-a-long" })));
    const mismatchedReference = await service.handle(request(verifyXml({ saleReferenceId: "1" })));
    const mismatchedOrder = await service.handle(request(verifyXml({ saleOrderId: "1" })));
    const mismatchedTerminal = await service.handle(request(verifyXml({ terminalId: "1" })));

    for (const response of [malformed, mismatchedReference, mismatchedOrder, mismatchedTerminal]) {
      const body = await response.text();
      expect(response.status).toBe(400);
      expect(body).toContain("<soap:Fault>");
      expect(body).not.toContain("fake-test-password");
    }
    expect(repository.getById(sold.id)).toEqual(sold);
  });

  it("runs Pay-to-Sale-to-Verify-to-Settle through local SOAP without another callback", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const paid = repository.getByRefId("LocalRef-Aa1");
    if (paid === undefined) {
      throw new Error("Pay fixture did not create transaction.");
    }
    const sold = repository.save(
      recordSaleSucceeded(
        paid,
        { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
        new ManualClock(new Date("2026-01-01T00:00:01.000Z")),
        new SequenceIdentifierGenerator(),
      ),
    );

    await service.handle(request(verifyXml()));
    const settled = await service.handle(request(settleXml()));
    const settledBody = await settled.text();
    const repeated = await service.handle(request(settleXml()));

    expect(settled.status).toBe(200);
    expect(settledBody).toContain("<bpSettleRequestResponse>");
    expect(settledBody).toContain("<bpSettleRequestResult>0</bpSettleRequestResult>");
    expect(repository.getById(sold.id)).toMatchObject({
      saleState: "SUCCEEDED",
      verificationState: "VERIFIED",
      settlementState: "REQUESTED",
    });
    expect(repository.getById(sold.id)?.events.filter((event) => event.type.startsWith("CALLBACK_DISPATCH"))).toHaveLength(0);
    // UNSPECIFIED: no page-22 Settle retry rule ties code 45 to bpSettleRequest.
    expect(repeated.status).toBe(400);
    expect(await repeated.text()).toContain("Client.InvalidSettleRequest");
  });

  it("keeps malformed, pre-Verify, and mismatched Settle requests local faults without mutation", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const paid = repository.getByRefId("LocalRef-Aa1");
    if (paid === undefined) {
      throw new Error("Pay fixture did not create transaction.");
    }
    const clock = new ManualClock(new Date("2026-01-01T00:00:01.000Z"));
    const identifiers = new SequenceIdentifierGenerator();
    const sold = repository.save(
      recordSaleSucceeded(
        paid,
        { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
        clock,
        identifiers,
      ),
    );

    const malformed = await service.handle(request(settleXml({ saleOrderId: "not-a-long" })));
    const mismatched = await service.handle(request(settleXml({ saleReferenceId: "1" })));
    const mismatchedTerminal = await service.handle(request(settleXml({ terminalId: "1" })));
    const mismatchedSaleOrder = await service.handle(request(settleXml({ saleOrderId: "1" })));
    const beforeVerify = await service.handle(request(settleXml()));

    for (const response of [malformed, mismatched, mismatchedTerminal, mismatchedSaleOrder, beforeVerify]) {
      const body = await response.text();
      expect(response.status).toBe(400);
      expect(body).toContain("<soap:Fault>");
      expect(body).not.toContain("fake-test-password");
      expect(body).not.toContain("<bpSettleRequestResult>");
    }
    expect(repository.getById(sold.id)).toEqual(sold);
  });

  it("runs Pay-to-Sale-to-VerifySettle atomically through local SOAP without callback dispatch", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const paid = repository.getByRefId("LocalRef-Aa1");
    if (paid === undefined) {
      throw new Error("Pay fixture did not create transaction.");
    }
    const sold = repository.save(recordSaleSucceeded(
      paid,
      { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
      new ManualClock(new Date("2026-01-01T00:00:01.000Z")),
      new SequenceIdentifierGenerator(),
    ));

    const combined = await service.handle(request(verifySettleXml()));
    const combinedBody = await combined.text();
    const repeated = await service.handle(request(verifySettleXml()));

    // PROTOCOL: page 32 explicitly makes 0/previously settled retry outcomes VerifySettle results; table 11 maps settled to 45.
    expect(combined.status).toBe(200);
    expect(combinedBody).toContain("<bpVerifySettleRequestResponse>");
    expect(combinedBody).toContain("<bpVerifySettleRequestResult>0</bpVerifySettleRequestResult>");
    expect(await repeated.text()).toContain("<bpVerifySettleRequestResult>45</bpVerifySettleRequestResult>");
    expect(repository.getById(sold.id)).toMatchObject({
      saleState: "SUCCEEDED",
      verificationState: "VERIFIED",
      settlementState: "REQUESTED",
    });
    expect(repository.getById(sold.id)?.events.map((event) => event.type)).toEqual([
      "TRANSACTION_CREATED",
      "REF_ID_ASSIGNED",
      "SALE_SUCCEEDED",
      "SETTLEMENT_REQUESTED",
    ]);
    expect(repository.getById(sold.id)?.events.at(-1)).toMatchObject({ via: "VERIFY_SETTLE" });
    expect(repository.getById(sold.id)?.events.filter((event) => event.type.startsWith("CALLBACK_DISPATCH"))).toHaveLength(0);
  });

  it("returns VerifySettle's documented known-state results without changing those states", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const verified = repository.getByRefId("LocalRef-Aa1");
    if (verified === undefined) {
      throw new Error("Pay fixture did not create transaction.");
    }
    const sold = repository.save(recordSaleSucceeded(
      verified,
      { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
      new ManualClock(new Date("2026-01-01T00:00:01.000Z")),
      new SequenceIdentifierGenerator(),
    ));
    await service.handle(request(verifyXml()));
    const beforeVerified = repository.getById(sold.id);
    const afterVerify = await service.handle(request(verifySettleXml()));
    expect(await afterVerify.text()).toContain("<bpVerifySettleRequestResult>43</bpVerifySettleRequestResult>");
    expect(repository.getById(sold.id)).toEqual(beforeVerified);

    await service.handle(request(settleXml()));
    const beforeSettled = repository.getById(sold.id);
    const afterSettle = await service.handle(request(verifySettleXml()));
    expect(await afterSettle.text()).toContain("<bpVerifySettleRequestResult>45</bpVerifySettleRequestResult>");
    expect(repository.getById(sold.id)).toEqual(beforeSettled);
  });

  it("returns VerifySettle reversed result and faults malformed/correlation failures without mutation", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const paid = repository.getByRefId("LocalRef-Aa1");
    if (paid === undefined) {
      throw new Error("Pay fixture did not create transaction.");
    }
    const clock = new ManualClock(new Date("2026-01-01T00:00:01.000Z"));
    const identifiers = new SequenceIdentifierGenerator();
    const reversed = repository.save(recordReversalCompleted(
      recordVerifyAttempted(recordSaleSucceeded(
        paid,
        { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
        clock,
        identifiers,
      ), clock, identifiers),
      clock,
      identifiers,
    ));
    const before = repository.getById(reversed.id);

    // PROTOCOL: page 32 names previous reversal for VerifySettle; table 11 maps it to 48.
    const reversedResponse = await service.handle(request(verifySettleXml()));
    expect(await reversedResponse.text()).toContain("<bpVerifySettleRequestResult>48</bpVerifySettleRequestResult>");
    expect(repository.getById(reversed.id)).toEqual(before);

    const malformed = await service.handle(request(verifySettleXml({ saleOrderId: "not-a-long" })));
    const mismatched = await service.handle(request(verifySettleXml({ saleReferenceId: "1" })));
    for (const response of [malformed, mismatched]) {
      const body = await response.text();
      expect(response.status).toBe(400);
      expect(body).toContain("<soap:Fault>");
      expect(body).not.toContain("fake-test-password");
      expect(body).not.toContain("<bpVerifySettleRequestResult>");
    }
    expect(repository.getById(reversed.id)).toEqual(before);
  });

  it("faults Inquiry without inventing provider result or ATTEMPTED-only eligibility", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const paid = repository.getByRefId("LocalRef-Aa1");
    if (paid === undefined) {
      throw new Error("Pay fixture did not create transaction.");
    }
    const sold = repository.save(recordSaleSucceeded(
      paid,
      { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
      new ManualClock(new Date("2026-01-01T00:00:01.000Z")),
      new SequenceIdentifierGenerator(),
    ));
    const transactionId = sold.id;
    const before = repository.getById(transactionId);

    const inquiry = await service.handle(request(inquiryXml()));
    const body = await inquiry.text();
    const after = repository.getById(transactionId);

    expect(inquiry.status).toBe(400);
    expect(body).toContain("Client.InvalidInquiryRequest");
    expect(body).not.toContain("<bpInquiryRequestResult>");
    expect(after).toEqual(before);
  });

  it("requires Verify before Reversal but does not invent Reversal result or mutation", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const paid = repository.getByRefId("LocalRef-Aa1");
    if (paid === undefined) {
      throw new Error("Pay fixture did not create transaction.");
    }
    const sold = repository.save(recordSaleSucceeded(
      paid,
      { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
      new ManualClock(new Date("2026-01-01T00:00:01.000Z")),
      new SequenceIdentifierGenerator(),
    ));
    const beforeVerify = await service.handle(request(reversalXml()));
    expect(beforeVerify.status).toBe(400);
    expect(await beforeVerify.text()).toContain("Client.InvalidReversalRequest");

    const attempted = repository.save(recordVerifyAttempted(
      sold,
      new ManualClock(new Date("2026-01-01T00:00:02.000Z")),
      new SequenceIdentifierGenerator(),
    ));
    const transactionId = attempted.id;
    const before = repository.getById(transactionId);

    const reversal = await service.handle(request(reversalXml({ orderId: "9007199254741995" })));
    const reversalBody = await reversal.text();

    expect(reversal.status).toBe(400);
    expect(reversalBody).toContain("Client.InvalidReversalRequest");
    expect(reversalBody).not.toContain("<bpReversalRequestResult>");
    expect(repository.getById(transactionId)).toEqual(before);
  });

  it("keeps malformed, mismatched, and known-state Inquiry/Reversal requests local faults without mutation", async () => {
    const { repository, service } = createService();
    await service.handle(request(payXml()));
    const transactionId = saveUnresolvedVerify(repository);
    const before = repository.getById(transactionId);
    const malformed = await service.handle(request(inquiryXml({ saleReferenceId: "not-a-long" })));
    const mismatch = await service.handle(request(reversalXml({ saleOrderId: "1" })));

    for (const response of [malformed, mismatch]) {
      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toContain("<soap:Fault>");
      expect(body).not.toContain("fake-test-password");
    }
    expect(repository.getById(transactionId)).toEqual(before);

    await service.handle(request(verifyXml()));
    const known = repository.getById(transactionId);
    const inquiry = await service.handle(request(inquiryXml()));
    const reversal = await service.handle(request(reversalXml()));
    expect(inquiry.status).toBe(400);
    expect(reversal.status).toBe(400);
    expect(repository.getById(transactionId)).toEqual(known);
  });
});
