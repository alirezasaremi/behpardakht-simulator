import { describe, expect, it } from "vitest";
import { localSimulator } from "@/server/local-simulator";
import { GET } from "./route";

let sequence = 0;

async function createRefId(): Promise<string> {
  sequence += 1;
  const response = await localSimulator.soap.handle(new Request("http://local.test/api/soap", {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8" },
    body: `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest><terminalId>9007199254740993</terminalId><userName>local</userName><userPassword>fake-local-password</userPassword><orderId>7100${sequence}</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime><additionalData>dashboard test</additionalData><callBackUrl>https://merchant.test/private?secret=no</callBackUrl><payerId>0</payerId></bpPayRequest></soap:Body></soap:Envelope>`,
  }));
  const refId = /<bpPayRequestResult>0,([^<]+)</.exec(await response.text())?.[1];
  if (refId === undefined) throw new Error("Expected local Pay RefId.");
  return refId;
}

describe("local dashboard transaction list route", () => {
  it("returns explicit safe DTOs with decimal bigint identifiers and preserved RefId casing", async () => {
    const refId = await createRefId();
    const response = GET(new Request("http://local.test/local/api/transactions?limit=100"));
    expect(response.status).toBe(200);
    const body = await response.json() as { transactions: Array<Record<string, unknown>> };
    const item = body.transactions.find((candidate) => candidate.refId === refId);
    expect(item).toMatchObject({ refId, terminalId: "9007199254740993", amount: "1000" });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/userpassword|password|callbackurl|raw.?xml|cvv|pin|otp/i);
  });

  it("is bounded and rejects invalid query limits", async () => {
    expect(GET(new Request("http://local.test/local/api/transactions?limit=101")).status).toBe(400);
    expect(GET(new Request("http://local.test/local/api/transactions?limit=no")).status).toBe(400);
  });
});
