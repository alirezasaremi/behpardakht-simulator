import { describe, expect, it } from "vitest";
import { localSimulator } from "@/server/local-simulator";
import { POST as paymentOutcome } from "../payment/[refId]/outcome/route";
import { POST as startPay } from "./route";

function payRequest(orderId: string, amount: string, callbackUrl: string): Request {
  return new Request("http://local.test/api/soap", {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8" },
    body: `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest>
      <terminalId>9007199254740993</terminalId><userName>local</userName><userPassword>fake-password</userPassword>
      <orderId>${orderId}</orderId><amount>${amount}</amount><localDate>20260101</localDate><localTime>120000</localTime>
      <additionalData>contract</additionalData><callBackUrl>${callbackUrl}</callBackUrl><payerId>0</payerId>
    </bpPayRequest></soap:Body></soap:Envelope>`,
  });
}

describe("local StartPay contract", () => {
  it("POSTs a known RefId into payment page and completes from stored transaction data", async () => {
    const soap = await localSimulator.soap.handle(
      payRequest("9007199254740995", "9007199254740997", "https://merchant.test/original-callback"),
    );
    const refId = /<bpPayRequestResult>0,([^<]+)</.exec(await soap.text())?.[1];
    expect(refId).toBeTruthy();

    const handoff = await startPay(
      new Request("http://local.test/local/start-pay", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ RefId: refId ?? "" }),
      }),
    );
    expect(handoff.status).toBe(303);
    expect(new URL(handoff.headers.get("location") ?? "", "http://local.test").pathname).toBe(
      `/local/payment/${encodeURIComponent(refId ?? "")}`,
    );

    const outcome = await paymentOutcome(
      new Request(`http://local.test/local/payment/${encodeURIComponent(refId ?? "")}/outcome`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ outcome: "SUCCESS" }),
      }),
      { params: Promise.resolve({ refId: refId ?? "" }) },
    );
    expect(outcome.status).toBe(303);
    const transaction = localSimulator.repository.getByRefId(refId ?? "");
    expect(transaction).toMatchObject({
      amount: BigInt("9007199254740997"),
      orderId: BigInt("9007199254740995"),
      callBackUrl: "https://merchant.test/original-callback",
      saleState: "SUCCEEDED",
    });
    expect(transaction?.events.at(-1)).toMatchObject({ type: "CALLBACK_DISPATCH_FAILED", reason: "DESTINATION_REJECTED" });
  });

  it("fails an unknown RefId without exposing a payment page", async () => {
    const response = await startPay(
      new Request("http://local.test/local/start-pay", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ RefId: "unknown" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Unknown RefId");
  });
});
