import { describe, expect, it, vi } from "vitest";
import {
  CallbackDispatcher,
  callbackAllowedOriginsFromEnvironment,
  encodeCallbackPayload,
  validateCallbackDestination,
} from "./dispatcher";
import { buildCallbackPayload } from "./payload";
import {
  ManualClock,
  SequenceIdentifierGenerator,
  assignRefId,
  createTransaction,
  recordSaleNonSuccess,
  recordSaleSucceeded,
} from "@/server/transactions";

function completedTransaction(callBackUrl = "https://merchant.test/callback") {
  const clock = new ManualClock(new Date("2026-01-01T00:00:00.000Z"));
  const identifiers = new SequenceIdentifierGenerator();
  const created = createTransaction(
    {
      terminalId: BigInt("9007199254740993"),
      orderId: BigInt("9007199254740995"),
      amount: BigInt("9007199254740997"),
      callBackUrl,
    },
    clock,
    identifiers,
  );
  return recordSaleSucceeded(
    assignRefId(created, "LocalRef-Aa1", clock, identifiers),
    { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("123456789012") },
    clock,
    identifiers,
  );
}

function cancelledTransaction() {
  const clock = new ManualClock(new Date("2026-01-01T00:00:00.000Z"));
  const identifiers = new SequenceIdentifierGenerator();
  const created = createTransaction(
    { terminalId: BigInt(10), orderId: BigInt(20), amount: BigInt(30_000), callBackUrl: "https://merchant.test/callback" },
    clock,
    identifiers,
  );
  return recordSaleNonSuccess(
    assignRefId(created, "LocalRef-cancelled", clock, identifiers),
    { refId: "LocalRef-cancelled", resCode: "17", saleOrderId: BigInt(20), saleReferenceId: BigInt(21) },
    clock,
    identifiers,
  );
}

describe("callback payload", () => {
  it("preserves documented callback names, correlation values, and bigint decimal text", () => {
    const payload = buildCallbackPayload(completedTransaction());

    expect(payload).toEqual({
      RefId: "LocalRef-Aa1",
      ResCode: "0",
      SaleOrderId: "9007199254740995",
      SaleReferenceId: "123456789012",
      CardHolderPan: "000000*****0000",
      CreditCardSaleResponseDetail: "",
      FinalAmount: "9007199254740997",
    });
    expect(new URLSearchParams(encodeCallbackPayload(payload)).get("CardHolderPan")).toBe("000000*****0000");
  });

  it("uses simulator zero FinalAmount for its cancellation scenario", () => {
    expect(buildCallbackPayload(cancelledTransaction())).toMatchObject({
      ResCode: "17",
      SaleOrderId: "20",
      SaleReferenceId: "21",
      FinalAmount: "0",
    });
  });
});

describe("CallbackDispatcher", () => {
  it("allows only explicitly configured exact origins and posts documented fields", async () => {
    const fetchImpl = vi.fn(async (url: URL, init: RequestInit) => {
      void url;
      void init;
      return new Response("ok", { status: 200 });
    });
    const dispatcher = new CallbackDispatcher({ allowedOrigins: new Set(["https://merchant.test"]), fetchImpl });

    await expect(dispatcher.dispatch(completedTransaction())).resolves.toEqual({ kind: "SUCCEEDED", httpStatus: 200 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url.toString()).toBe("https://merchant.test/callback");
    expect(init).toMatchObject({ method: "POST", redirect: "error" });
    expect(new URLSearchParams(String(init?.body)).get("SaleOrderId")).toBe("9007199254740995");
    expect(new URLSearchParams(String(init?.body)).get("FinalAmount")).toBe("9007199254740997");
  });

  it("rejects disallowed origins, unsafe protocols, and callback credentials without outbound request", async () => {
    const fetchImpl = vi.fn(async (url: URL, init: RequestInit) => {
      void url;
      void init;
      return new Response("unexpected");
    });
    const dispatcher = new CallbackDispatcher({ allowedOrigins: new Set(["https://merchant.test"]), fetchImpl });

    for (const callbackUrl of ["https://elsewhere.test/callback", "ftp://merchant.test/callback", "https://user:pass@merchant.test/callback"]) {
      await expect(dispatcher.dispatch(completedTransaction(callbackUrl))).resolves.toEqual({
        kind: "FAILED",
        reason: "DESTINATION_REJECTED",
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not follow redirects and classifies non-success HTTP separately", async () => {
    const fetchImpl = vi.fn(async (url: URL, init: RequestInit) => {
      void url;
      void init;
      return new Response(null, { status: 302, headers: { location: "https://elsewhere.test" } });
    });
    const dispatcher = new CallbackDispatcher({ allowedOrigins: new Set(["https://merchant.test"]), fetchImpl });

    await expect(dispatcher.dispatch(completedTransaction())).resolves.toEqual({
      kind: "FAILED",
      reason: "HTTP_NON_SUCCESS",
      httpStatus: 302,
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe("error");
  });

  it("bounds callback response consumption", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(32));
      },
      cancel() {
        cancelled = true;
      },
    });
    const dispatcher = new CallbackDispatcher({
      allowedOrigins: new Set(["https://merchant.test"]),
      responseMaxBytes: 8,
      fetchImpl: async () => new Response(body, { status: 200 }),
    });

    await expect(dispatcher.dispatch(completedTransaction())).resolves.toEqual({ kind: "SUCCEEDED", httpStatus: 200 });
    expect(cancelled).toBe(true);
  });

  it("enforces a timeout", async () => {
    const dispatcher = new CallbackDispatcher({
      allowedOrigins: new Set(["https://merchant.test"]),
      timeoutMs: 1,
      fetchImpl: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    });

    await expect(dispatcher.dispatch(completedTransaction())).resolves.toEqual({ kind: "FAILED", reason: "TIMEOUT" });
  });
});

describe("callback allowlist configuration", () => {
  it("defaults to no destinations and accepts only origin-shaped configuration", () => {
    expect(callbackAllowedOriginsFromEnvironment()).toEqual(new Set());
    expect(callbackAllowedOriginsFromEnvironment("http://localhost:4010, https://merchant.test")).toEqual(
      new Set(["http://localhost:4010", "https://merchant.test"]),
    );
    expect(callbackAllowedOriginsFromEnvironment("https://merchant.test/path, ftp://merchant.test")).toEqual(new Set());
    expect(validateCallbackDestination("https://merchant.test/callback", new Set(["https://merchant.test"]))?.pathname).toBe("/callback");
  });
});
