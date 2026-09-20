import { describe, expect, it, vi } from "vitest";
import { CallbackDispatcher } from "@/server/callbacks";
import { ManualClock, InMemoryTransactionRepository, SequenceIdentifierGenerator, assignRefId, createTransaction } from "@/server/transactions";
import { SequenceSaleReferenceIdGenerator } from "./identifiers";
import { LocalPaymentService } from "./service";

function fixture(fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))) {
  const repository = new InMemoryTransactionRepository();
  const clock = new ManualClock(new Date("2026-01-01T00:00:00.000Z"));
  const identifiers = new SequenceIdentifierGenerator();
  const transaction = repository.create(
    assignRefId(
      createTransaction(
        {
          terminalId: BigInt(10),
          orderId: BigInt("9007199254740995"),
          amount: BigInt("9007199254740997"),
          callBackUrl: "https://merchant.test/callback",
        },
        clock,
        identifiers,
      ),
      "LocalRef-Aa1",
      clock,
      identifiers,
    ),
  );
  const service = new LocalPaymentService({
    repository,
    clock,
    identifiers,
    saleReferenceIds: new SequenceSaleReferenceIdGenerator(),
    callbacks: new CallbackDispatcher({ allowedOrigins: new Set(["https://merchant.test"]), fetchImpl }),
  });
  return { repository, service, transaction, fetchImpl };
}

describe("LocalPaymentService", () => {
  it("finds StartPay transactions by RefId and rejects unknown values", () => {
    const { service, transaction } = fixture();
    expect(service.findByRefId("LocalRef-Aa1")).toEqual(transaction);
    expect(() => service.findByRefId("unknown")).toThrow(expect.objectContaining({ code: "UNKNOWN_REF_ID" }));
  });

  it("records a successful Sale, deterministic numeric SaleReferenceId, and callback event", async () => {
    const { repository, service } = fixture();
    const completed = await service.complete("LocalRef-Aa1", "SUCCESS");

    expect(completed).toMatchObject({
      saleState: "SUCCEEDED",
      saleResCode: "0",
      saleOrderId: BigInt("9007199254740995"),
      saleReferenceId: BigInt(1),
    });
    expect(completed.events.map((event) => event.type)).toEqual([
      "TRANSACTION_CREATED",
      "REF_ID_ASSIGNED",
      "SALE_SUCCEEDED",
      "CALLBACK_DISPATCH_ATTEMPTED",
      "CALLBACK_DISPATCH_SUCCEEDED",
    ]);
    expect(repository.getByRefId("LocalRef-Aa1")).toEqual(completed);
  });

  it("uses documented cancellation code 17 for only exposed non-success simulator choice", async () => {
    const { service } = fixture();
    const completed = await service.complete("LocalRef-Aa1", "NON_SUCCESS");

    expect(completed).toMatchObject({ saleState: "NON_SUCCESS", saleResCode: "17", saleOrderId: BigInt("9007199254740995") });
    expect(completed.events.at(-3)).toMatchObject({ type: "SALE_NON_SUCCESS", resCode: "17" });
  });

  it("keeps successful Sale state when callback transport fails", async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error("local receiver unavailable");
    });
    const { service } = fixture(failingFetch);
    const completed = await service.complete("LocalRef-Aa1", "SUCCESS");

    expect(completed.saleState).toBe("SUCCEEDED");
    expect(completed.events.at(-1)).toMatchObject({ type: "CALLBACK_DISPATCH_FAILED", reason: "TRANSPORT_ERROR" });
  });

  it("rejects duplicate payment-page submissions without a second callback", async () => {
    const { service, fetchImpl } = fixture();
    await service.complete("LocalRef-Aa1", "SUCCESS");

    await expect(service.complete("LocalRef-Aa1", "SUCCESS")).rejects.toBeInstanceOf(Error);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
