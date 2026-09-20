import { describe, expect, it } from "vitest";
import { InMemoryTransactionRepository, ManualClock, SequenceIdentifierGenerator } from "@/server/transactions";
import { createLocalSoapService } from "./service";

function dynamicPayXml() {
  const fields = { terminalId: "9007199254740993", userName: "local-merchant", userPassword: "fake-test-password", orderId: "9007199254740995", amount: "1000", localDate: "20260101", localTime: "120000", additionalData: "safe test", callBackUrl: "https://merchant.test/callback", payerId: "0", subServiceId: "9007199254740997" };
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpDynamicPayRequest>${Object.entries(fields).map(([name, value]) => `<${name}>${value}</${name}>`).join("")}</bpDynamicPayRequest></soap:Body></soap:Envelope>`;
}

function payXml() {
  const fields = { terminalId: "9007199254740993", userName: "local-merchant", userPassword: "fake-test-password", orderId: "9007199254740995", amount: "1000", localDate: "20260101", localTime: "120000", additionalData: "safe test", callBackUrl: "https://merchant.test/callback", payerId: "0" };
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest>${Object.entries(fields).map(([name, value]) => `<${name}>${value}</${name}>`).join("")}</bpPayRequest></soap:Body></soap:Envelope>`;
}

function request(xml: string): Request {
  return new Request("http://local.test/api/soap", { method: "POST", headers: { "content-type": "text/xml" }, body: xml });
}

describe("LocalSoapService bpDynamicPayRequest", () => {
  it("runs HTTP/SOAP parsing through safe Dynamic Pay request creation and local lifecycle state", async () => {
    const repository = new InMemoryTransactionRepository();
    const service = createLocalSoapService({ repository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers: new SequenceIdentifierGenerator(), refIds: { nextRefId: () => "Dynamic-Soap-Ref" } });
    const response = await service.handle(request(dynamicPayXml()));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<bpDynamicPayRequestResult>0,Dynamic-Soap-Ref</bpDynamicPayRequestResult>");
    expect(repository.getByTerminalIdAndOrderId(BigInt("9007199254740993"), BigInt("9007199254740995"))).toMatchObject({ paymentOperation: "DYNAMIC_PAY", refId: "Dynamic-Soap-Ref", lifecycleState: "AWAITING_SALE" });
  });

  it("returns a local duplicate fault without creating a second Dynamic Pay request", async () => {
    const repository = new InMemoryTransactionRepository();
    const service = createLocalSoapService({ repository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers: new SequenceIdentifierGenerator(), refIds: { nextRefId: () => "Dynamic-Soap-Ref" } });
    await service.handle(request(dynamicPayXml()));
    const duplicate = await service.handle(request(dynamicPayXml()));

    expect(duplicate.status).toBe(409);
    expect(await duplicate.text()).toContain("<faultcode>Client.DuplicateDynamicPayOrderId</faultcode>");
    expect(repository.list()).toHaveLength(1);
  });

  it("returns local duplicate faults for both Pay/Dynamic Pay orderings", async () => {
    const dynamicFirstRepository = new InMemoryTransactionRepository();
    const dynamicFirst = createLocalSoapService({ repository: dynamicFirstRepository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers: new SequenceIdentifierGenerator(), refIds: { nextRefId: () => "Ref-1" } });
    await dynamicFirst.handle(request(dynamicPayXml()));
    const payDuplicate = await dynamicFirst.handle(request(payXml()));

    expect(payDuplicate.status).toBe(409);
    expect(await payDuplicate.text()).toContain("<faultcode>Client.DuplicatePayOrderId</faultcode>");
    expect(dynamicFirstRepository.list()).toHaveLength(1);

    const payFirstRepository = new InMemoryTransactionRepository();
    const payFirst = createLocalSoapService({ repository: payFirstRepository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers: new SequenceIdentifierGenerator(), refIds: { nextRefId: () => "Ref-1" } });
    await payFirst.handle(request(payXml()));
    const dynamicDuplicate = await payFirst.handle(request(dynamicPayXml()));

    expect(dynamicDuplicate.status).toBe(409);
    expect(await dynamicDuplicate.text()).toContain("<faultcode>Client.DuplicateDynamicPayOrderId</faultcode>");
    expect(payFirstRepository.list()).toHaveLength(1);
  });
});
