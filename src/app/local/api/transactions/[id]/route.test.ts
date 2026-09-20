import { describe, expect, it } from "vitest";
import { localSimulator } from "@/server/local-simulator";
import { GET } from "./route";

describe("local dashboard transaction detail route", () => {
  it("returns unknown transaction safely without protocol or aggregate mutation", async () => {
    const response = await GET(new Request("http://local.test/local/api/transactions/missing"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Unknown local transaction." });
  });

  it("does not execute or mutate when reading an existing transaction", async () => {
    const paid = await localSimulator.soap.handle(new Request("http://local.test/api/soap", {
      method: "POST",
      headers: { "content-type": "text/xml; charset=utf-8" },
      body: `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest><terminalId>9007199254740993</terminalId><userName>local</userName><userPassword>fake-password</userPassword><orderId>719999001</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime><additionalData>detail test</additionalData><callBackUrl>https://merchant.test/callback</callBackUrl><payerId>0</payerId></bpPayRequest></soap:Body></soap:Envelope>`,
    }));
    const refId = /<bpPayRequestResult>0,([^<]+)</.exec(await paid.text())?.[1];
    if (refId === undefined) throw new Error("Expected local Pay RefId.");
    const transaction = localSimulator.repository.getByRefId(refId);
    if (transaction === undefined) throw new Error("Expected saved transaction.");
    const before = localSimulator.repository.getById(transaction.id)!;
    const response = await GET(new Request(`http://local.test/local/api/transactions/${transaction.id}`), { params: Promise.resolve({ id: transaction.id }) });
    expect(response.status).toBe(200);
    expect(localSimulator.repository.getById(transaction.id)).toEqual(before);
  });
});
