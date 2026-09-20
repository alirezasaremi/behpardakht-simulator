import { describe, expect, it } from "vitest";
import { InMemoryTransactionRepository, ManualClock, SequenceIdentifierGenerator } from "@/server/transactions";
import { createLocalSoapService } from "./service";

function xml(overrides: Record<string, string> = {}): string {
  const fields = {
    terminalId: "9007199254740993", userName: "local-merchant", userPassword: "fake-test-password", orderId: "9007199254740995",
    amount: "900719925474099912345", localDate: "20260101", localTime: "120000",
    additionalData: "account-one,900719925474099900000,payer-one;account-two,12345,", callBackUrl: "https://merchant.test/callback", ...overrides,
  };
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpCumulativeDynamicPayRequest>${Object.entries(fields).map(([name, value]) => `<${name}>${value}</${name}>`).join("")}</bpCumulativeDynamicPayRequest></soap:Body></soap:Envelope>`;
}

function request(body: string): Request {
  return new Request("http://local.test/api/soap", { method: "POST", headers: { "content-type": "text/xml" }, body });
}

describe("LocalSoapService bpCumulativeDynamicPayRequest", () => {
  it("runs SOAP parser through documented normal result and safe local transaction", async () => {
    const repository = new InMemoryTransactionRepository();
    const service = createLocalSoapService({ repository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers: new SequenceIdentifierGenerator(), refIds: { nextRefId: () => "Cumulative-Soap-Ref" } });
    const response = await service.handle(request(xml()));
    const transaction = repository.getByTerminalIdAndOrderId(BigInt("9007199254740993"), BigInt("9007199254740995"));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<bpCumulativeDynamicPayRequestResult>0,Cumulative-Soap-Ref</bpCumulativeDynamicPayRequestResult>");
    expect(transaction).toMatchObject({ paymentOperation: "CUMULATIVE_DYNAMIC_PAY", amount: BigInt("900719925474099912345"), refId: "Cumulative-Soap-Ref", lifecycleState: "AWAITING_SALE" });
    expect(transaction).not.toHaveProperty("additionalData");
  });

  it("returns local validation and duplicate faults with no partial request creation", async () => {
    const repository = new InMemoryTransactionRepository();
    const service = createLocalSoapService({ repository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers: new SequenceIdentifierGenerator(), refIds: { nextRefId: () => "Cumulative-Soap-Ref" } });
    const invalid = await service.handle(request(xml({ amount: "1" })));
    expect(invalid.status).toBe(400);
    expect(repository.list()).toHaveLength(0);

    await service.handle(request(xml()));
    const duplicate = await service.handle(request(xml()));
    expect(duplicate.status).toBe(409);
    expect(await duplicate.text()).toContain("<faultcode>Client.DuplicateCumulativeDynamicPayOrderId</faultcode>");
    expect(repository.list()).toHaveLength(1);
  });
});
