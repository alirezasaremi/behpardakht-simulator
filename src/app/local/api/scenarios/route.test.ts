import { describe, expect, it } from "vitest";
import { localSimulator } from "@/server/local-simulator";
import { DELETE, GET, POST } from "./route";

function payRequest(orderId: string): Request {
  return new Request("http://local.test/api/soap", {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8" },
    body: `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest>
      <terminalId>9007199254740993</terminalId><userName>local</userName><userPassword>fake-password</userPassword>
      <orderId>${orderId}</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime>
      <additionalData>scenario control</additionalData><callBackUrl>https://merchant.test/callback</callBackUrl><payerId>0</payerId>
    </bpPayRequest></soap:Body></soap:Envelope>`,
  });
}

async function createRefId(): Promise<string> {
  const response = await localSimulator.soap.handle(payRequest(`819${Date.now()}`));
  const refId = /<bpPayRequestResult>0,([^<]+)</.exec(await response.text())?.[1];
  if (refId === undefined) {
    throw new Error("Expected local Pay RefId.");
  }
  return refId;
}

function jsonRequest(method: "POST" | "DELETE", body: unknown): Request {
  return new Request("http://local.test/local/api/scenarios", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("local scenario control route", () => {
  it("lists bounded simulator scenarios", async () => {
    expect(await GET().json()).toEqual({ classification: "SIMULATOR_SCENARIO", scenarios: ["NORMAL", "VERIFY_UNRESOLVED", "KNOWN_REVERSED"] });
  });

  it("assigns and clears transaction-scoped scenario without SOAP configuration", async () => {
    const refId = await createRefId();
    const assigned = await POST(jsonRequest("POST", { refId, scenario: "VERIFY_UNRESOLVED" }));
    expect(assigned.status).toBe(200);
    expect(await assigned.json()).toMatchObject({ refId, scenario: "VERIFY_UNRESOLVED" });

    const cleared = await DELETE(jsonRequest("DELETE", { refId }));
    expect(cleared.status).toBe(200);
    expect(await cleared.json()).toMatchObject({ refId, scenario: "NORMAL", lifecycleState: "AWAITING_SALE" });
  });

  it("rejects malformed, unknown, and generic-state-edit input", async () => {
    expect((await POST(new Request("http://local.test/local/api/scenarios", { method: "POST", body: "{}" }))).status).toBe(415);
    expect((await POST(jsonRequest("POST", { refId: "unknown", scenario: "VERIFY_UNRESOLVED" }))).status).toBe(404);
    expect((await POST(jsonRequest("POST", { refId: "unknown", scenario: "RETURN_CODE_43" }))).status).toBe(400);
    expect((await POST(jsonRequest("POST", { refId: "unknown", scenario: "NORMAL", verificationState: "VERIFIED" }))).status).toBe(400);
    expect((await POST(new Request("http://local.test/local/api/scenarios", {
      method: "POST", headers: { "content-type": "application/json" }, body: `{"refId":"${"x".repeat(1_024)}"}`,
    }))).status).toBe(413);
  });
});
