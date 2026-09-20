import { describe, expect, it } from "vitest";
import {
  ManualClock,
  InMemoryTransactionRepository,
  SequenceIdentifierGenerator,
  assignRefId,
  createTransaction,
  recordSaleSucceeded,
  recordVerificationConfirmed,
  recordVerifyAttempted,
} from "@/server/transactions";
import { BpSettleRequestHandler, type BpSettleRequestInput } from "./settle-request";

const initialTime = new Date("2026-01-01T00:00:00.000Z");

function fixture() {
  const repository = new InMemoryTransactionRepository();
  const clock = new ManualClock(initialTime);
  const identifiers = new SequenceIdentifierGenerator();
  const original = repository.create(
    assignRefId(
      createTransaction(
        {
          terminalId: BigInt("9007199254740993"),
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
  const sold = recordSaleSucceeded(
    original,
    {
      refId: "LocalRef-Aa1",
      saleOrderId: BigInt("9007199254740995"),
      saleReferenceId: BigInt("9007199254740999"),
    },
    clock,
    identifiers,
  );
  const verified = repository.save(
    recordVerificationConfirmed(recordVerifyAttempted(sold, clock, identifiers), clock, identifiers),
  );
  const handler = new BpSettleRequestHandler({ repository, clock, identifiers });
  const input: BpSettleRequestInput = {
    terminalId: BigInt("9007199254740993"),
    userName: "local-merchant",
    userPassword: "fake-test-password",
    orderId: BigInt("9007199254740995"),
    saleOrderId: BigInt("9007199254740995"),
    saleReferenceId: BigInt("9007199254740999"),
  };
  return { repository, clock, identifiers, verified, handler, input };
}

describe("BpSettleRequestHandler", () => {
  it("records accepted settlement after Verify with immutable ordered event history", () => {
    const { repository, clock, handler, input } = fixture();
    clock.advanceBy(1_000);

    const result = handler.execute(input);
    const stored = repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });

    // PROTOCOL: v1.39 printed page 22 says 0 is successful receipt of Settle request.
    expect(result.result).toBe("0");
    expect(stored).toMatchObject({
      saleState: "SUCCEEDED",
      verificationState: "VERIFIED",
      settlementState: "REQUESTED",
      lifecycleState: "SETTLEMENT_REQUESTED",
      settlementRequestedAt: "2026-01-01T00:00:01.000Z",
      saleOrderId: BigInt("9007199254740995"),
      saleReferenceId: BigInt("9007199254740999"),
    });
    expect(stored?.events.map((event) => event.type)).toEqual([
      "TRANSACTION_CREATED",
      "REF_ID_ASSIGNED",
      "SALE_SUCCEEDED",
      "VERIFY_ATTEMPTED",
      "VERIFICATION_CONFIRMED",
      "SETTLEMENT_REQUESTED",
    ]);
    expect(stored?.events.at(-1)).toMatchObject({ type: "SETTLEMENT_REQUESTED", at: "2026-01-01T00:00:01.000Z", via: "SETTLE" });
    expect("userPassword" in (stored ?? {})).toBe(false);
    expect(stored?.events.every((event) => !("userPassword" in event))).toBe(true);
  });

  it("does not use Settle orderId for correlation or uniqueness", () => {
    const { repository, clock, identifiers, handler, input } = fixture();
    const other = repository.create(
      assignRefId(
        createTransaction(
          {
            terminalId: input.terminalId,
            orderId: BigInt("9007199254741995"),
            amount: BigInt(1_000),
            callBackUrl: "https://merchant.test/other",
          },
          clock,
          identifiers,
        ),
        "LocalRef-Aa2",
        clock,
        identifiers,
      ),
    );
    repository.save(
      recordVerificationConfirmed(
        recordVerifyAttempted(
          recordSaleSucceeded(
            other,
            { refId: "LocalRef-Aa2", saleOrderId: BigInt("9007199254741995"), saleReferenceId: BigInt("9007199254742999") },
            clock,
            identifiers,
          ),
          clock,
          identifiers,
        ),
        clock,
        identifiers,
      ),
    );

    expect(handler.execute(input).result).toBe("0");
    // PROTOCOL: page 22 says Settle orderId is non-unique and may equal saleOrderId.
    expect(
      handler.execute({
        ...input,
        saleOrderId: BigInt("9007199254741995"),
        saleReferenceId: BigInt("9007199254742999"),
      }).result,
    ).toBe("0");
  });

  it("rejects repeated, before-Verify, and mismatched Settle without partial mutation", () => {
    const { repository, clock, identifiers, handler, input, verified } = fixture();
    const before = repository.getById(verified.id);

    for (const mismatchedInput of [
      { ...input, terminalId: BigInt(1) },
      { ...input, saleOrderId: BigInt(1) },
      { ...input, saleReferenceId: BigInt(1) },
    ]) {
      expect(() => handler.execute(mismatchedInput)).toThrow(
        expect.objectContaining({ code: "SETTLE_CORRELATION_NOT_FOUND" }),
      );
    }
    expect(repository.getById(verified.id)).toEqual(before);

    handler.execute(input);
    const settled = repository.getById(verified.id);
    expect(() => handler.execute(input)).toThrow(expect.objectContaining({ code: "SETTLE_NOT_ELIGIBLE" }));
    expect(repository.getById(verified.id)).toEqual(settled);

    const saleOnly = repository.create(
      assignRefId(
        createTransaction(
          { terminalId: BigInt(1), orderId: BigInt(2), amount: BigInt(3), callBackUrl: "https://merchant.test/sale-only" },
          clock,
          identifiers,
        ),
        "LocalRef-SaleOnly",
        clock,
        identifiers,
      ),
    );
    const sold = repository.save(
      recordSaleSucceeded(
        saleOnly,
        { refId: "LocalRef-SaleOnly", saleOrderId: BigInt(2), saleReferenceId: BigInt(3) },
        clock,
        identifiers,
      ),
    );
    expect(() =>
      handler.execute({ ...input, terminalId: BigInt(1), saleOrderId: BigInt(2), saleReferenceId: BigInt(3) }),
    ).toThrow(expect.objectContaining({ code: "SETTLE_NOT_ELIGIBLE" }));
    expect(repository.getById(sold.id)).toEqual(sold);
  });
});
