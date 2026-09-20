import { describe, expect, it } from "vitest";
import { localSimulator } from "@/server/local-simulator";
import { DELETE, GET, POST } from "./route";

let orderSequence = 0;

async function createRefId(): Promise<string> {
  orderSequence += 1;
  const orderId = `731000${orderSequence}`;
  const response = await localSimulator.soap.handle(new Request("http://local.test/api/soap", {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8" },
    body: `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest>
      <terminalId>9007199254740993</terminalId><userName>local</userName><userPassword>fake-password</userPassword>
      <orderId>${orderId}</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime>
      <additionalData>transport control</additionalData><callBackUrl>https://merchant.test/callback</callBackUrl><payerId>0</payerId>
    </bpPayRequest></soap:Body></soap:Envelope>`,
  }));
  const refId = /<bpPayRequestResult>0,([^<]+)</.exec(await response.text())?.[1];
  if (refId === undefined) throw new Error("Expected local Pay RefId.");
  return refId;
}

function jsonRequest(method: "POST" | "DELETE", body: unknown): Request {
  return new Request("http://local.test/local/api/transport-faults", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("local transport fault control route", () => {
  it("lists bounded profiles and eligible target operations", async () => {
    expect(await GET().json()).toEqual({
      classification: "SIMULATOR_SCENARIO",
      profiles: ["NORMAL", "PRE_EXECUTION_HTTP_FAILURE", "POST_EXECUTION_HTTP_FAILURE", "POST_EXECUTION_MALFORMED_SOAP", "POST_EXECUTION_DELAY"],
      operations: ["bpVerifyRequest", "bpSettleRequest", "bpVerifySettleRequest"],
      consumption: "ONE_SHOT",
    });
  });

  it("assigns and clears exact transaction-scoped, one-shot configuration", async () => {
    const refId = await createRefId();
    const assigned = await POST(jsonRequest("POST", {
      refId, profile: "POST_EXECUTION_HTTP_FAILURE", operation: "bpVerifyRequest",
    }));
    expect(assigned.status).toBe(200);
    expect(await assigned.json()).toEqual({ refId, profile: "POST_EXECUTION_HTTP_FAILURE", operation: "bpVerifyRequest", consumption: "ONE_SHOT" });
    expect(localSimulator.transportFaults.getAssignment(localSimulator.repository.getByRefId(refId)!)).toEqual({
      profile: "POST_EXECUTION_HTTP_FAILURE", operation: "bpVerifyRequest",
    });

    expect((await DELETE(jsonRequest("DELETE", { refId }))).status).toBe(200);
    expect(localSimulator.transportFaults.getAssignment(localSimulator.repository.getByRefId(refId)!)).toBeUndefined();
  });

  it("rejects malformed, unknown, extra, arbitrary response, and arbitrary delay input", async () => {
    expect((await POST(new Request("http://local.test/local/api/transport-faults", { method: "POST", body: "{}" }))).status).toBe(415);
    expect((await POST(jsonRequest("POST", { refId: "unknown", profile: "POST_EXECUTION_HTTP_FAILURE", operation: "bpVerifyRequest" }))).status).toBe(404);
    expect((await POST(jsonRequest("POST", { refId: "unknown", profile: "HTTP_599", operation: "bpVerifyRequest" }))).status).toBe(400);
    expect((await POST(jsonRequest("POST", { refId: "unknown", profile: "POST_EXECUTION_HTTP_FAILURE", operation: "bpPayRequest" }))).status).toBe(400);
    expect((await POST(jsonRequest("POST", {
      refId: "unknown", profile: "POST_EXECUTION_HTTP_FAILURE", operation: "bpVerifyRequest", status: 599,
    }))).status).toBe(400);
    expect((await POST(jsonRequest("POST", {
      refId: "unknown", profile: "POST_EXECUTION_DELAY", operation: "bpVerifyRequest", milliseconds: 99,
    }))).status).toBe(400);
  });
});
