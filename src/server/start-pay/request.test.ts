import { describe, expect, it } from "vitest";
import { extractPaymentOutcome, extractStartPayRefId, hasTrustedLocalFormOrigin } from "./request";

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

  it("accepts actual local Host origins despite runtime localhost canonicalization and rejects cross-origin forms", () => {
    const localhostRuntimeWithLoopbackBrowser = new Request("http://localhost:3000/local/payment/ref/outcome", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
    });
    const crossOrigin = new Request("http://localhost:3000/local/payment/ref/outcome", {
      method: "POST",
      headers: { origin: "https://attacker.test", host: "127.0.0.1:3000" },
    });

    expect(hasTrustedLocalFormOrigin(localhostRuntimeWithLoopbackBrowser)).toBe(true);
    expect(hasTrustedLocalFormOrigin(crossOrigin)).toBe(false);
  });
});
