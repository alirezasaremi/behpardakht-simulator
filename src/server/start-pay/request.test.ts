import { describe, expect, it } from "vitest";
import { extractPaymentOutcome, extractStartPayRefId } from "./request";

function formRequest(body: string): Request {
  return new Request("http://local.test/local/start-pay", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("local StartPay form boundary", () => {
  it("accepts only one RefId", async () => {
    await expect(extractStartPayRefId(formRequest("RefId=LocalRef-Aa1"))).resolves.toBe("LocalRef-Aa1");
    await expect(extractStartPayRefId(formRequest("RefId=one&RefId=two"))).rejects.toThrow("exactly one RefId");
    await expect(extractStartPayRefId(formRequest("RefId=one&amount=1"))).rejects.toThrow("exactly one RefId");
  });

  it("rejects unsupported form encodings and accepts only fixed outcome values", async () => {
    await expect(
      extractStartPayRefId(
        new Request("http://local.test/local/start-pay", { method: "POST", body: JSON.stringify({ RefId: "one" }) }),
      ),
    ).rejects.toThrow("URL-encoded");
    await expect(extractPaymentOutcome(formRequest("outcome=SUCCESS"))).resolves.toBe("SUCCESS");
    await expect(extractPaymentOutcome(formRequest("outcome=amount-override"))).rejects.toThrow("unsupported outcome");
  });
});
