import { describe, expect, it } from "vitest";
import {
  ManualClock,
  InMemoryTransactionRepository,
  SequenceIdentifierGenerator,
  assignRefId,
  createTransaction,
  recordReversalCompleted,
  recordSaleNonSuccess,
  recordSaleSucceeded,
  recordSettlementRequested,
  recordVerificationConfirmed,
  recordVerifyAttempted,
} from "@/server/transactions";
import { BpVerifySettleRequestHandler, type BpVerifySettleRequestInput } from "./verify-settle-request";

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
  const sold = repository.save(
    recordSaleSucceeded(
      original,
      {
        refId: "LocalRef-Aa1",
        saleOrderId: BigInt("9007199254740995"),
        saleReferenceId: BigInt("9007199254740999"),
      },
      clock,
      identifiers,
    ),
  );
  const handler = new BpVerifySettleRequestHandler({ repository, clock, identifiers });
  const input: BpVerifySettleRequestInput = {
    terminalId: BigInt("9007199254740993"),
    userName: "local-merchant",
    userPassword: "fake-test-password",
    orderId: BigInt("9007199254740995"),
    saleOrderId: BigInt("9007199254740995"),
    saleReferenceId: BigInt("9007199254740999"),
  };
  return { repository, clock, identifiers, sold, handler, input };
}

describe("BpVerifySettleRequestHandler", () => {
  it("atomically records documented combined success without separate Verify events", () => {
    const { repository, clock, handler, input } = fixture();
    clock.advanceBy(1_000);

    const result = handler.execute(input);
    const stored = repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });

    // PROTOCOL: v1.39 printed page 32 says VerifySettle ResCode 0 is successful payment-page transaction and calls it for bank-side verification/settlement.
    expect(result.result).toBe("0");
    expect(stored).toMatchObject({
      saleState: "SUCCEEDED",
      verificationState: "VERIFIED",
      settlementState: "REQUESTED",
      lifecycleState: "SETTLEMENT_REQUESTED",
      verifiedAt: "2026-01-01T00:00:01.000Z",
      settlementRequestedAt: "2026-01-01T00:00:01.000Z",
    });
    expect(stored?.events.map((event) => event.type)).toEqual([
      "TRANSACTION_CREATED",
      "REF_ID_ASSIGNED",
      "SALE_SUCCEEDED",
      "SETTLEMENT_REQUESTED",
    ]);
    expect(stored?.events.at(-1)).toMatchObject({
      type: "SETTLEMENT_REQUESTED",
      via: "VERIFY_SETTLE",
      at: "2026-01-01T00:00:01.000Z",
    });
    expect("userPassword" in (stored ?? {})).toBe(false);
    expect(stored?.events.every((event) => !("userPassword" in event))).toBe(true);
  });

  it("returns each VerifySettle-specific known-state result without mutation", () => {
    const { repository, clock, identifiers, handler, input, sold } = fixture();

    const verified = repository.save(
      recordVerificationConfirmed(recordVerifyAttempted(sold, clock, identifiers), clock, identifiers),
    );
    const beforeVerified = repository.getById(verified.id);
    // PROTOCOL: page 32 names previously verified for a VerifySettle retry; table 11 maps it to 43.
    expect(handler.execute(input).result).toBe("43");
    expect(repository.getById(verified.id)).toEqual(beforeVerified);

    const settled = repository.save(recordSettlementRequested(verified, clock, identifiers));
    const beforeSettled = repository.getById(settled.id);
    // PROTOCOL: page 32 names previously settled for a VerifySettle retry; table 11 maps it to 45.
    expect(handler.execute(input).result).toBe("45");
    expect(repository.getById(settled.id)).toEqual(beforeSettled);
  });

  it("returns known reversed result and faults non-success/correlation calls without partial mutation", () => {
    const { repository, clock, identifiers, handler, input, sold } = fixture();
    const reversed = repository.save(
      recordReversalCompleted(recordVerifyAttempted(sold, clock, identifiers), clock, identifiers),
    );
    const beforeReversed = repository.getById(reversed.id);
    // PROTOCOL: page 32 names previously reversed for a VerifySettle retry; table 11 maps it to 48.
    expect(handler.execute(input).result).toBe("48");
    expect(repository.getById(reversed.id)).toEqual(beforeReversed);

    expect(() => handler.execute({ ...input, saleReferenceId: BigInt(1) })).toThrow(
      expect.objectContaining({ code: "VERIFY_SETTLE_CORRELATION_NOT_FOUND" }),
    );
    expect(repository.getById(reversed.id)).toEqual(beforeReversed);

    const nonSuccess = repository.save(
      recordSaleNonSuccess(
        repository.create(
          assignRefId(
            createTransaction(
              { terminalId: BigInt(1), orderId: BigInt(2), amount: BigInt(3), callBackUrl: "https://merchant.test/non-success" },
              clock,
              identifiers,
            ),
            "LocalRef-NonSuccess",
            clock,
            identifiers,
          ),
        ),
        { refId: "LocalRef-NonSuccess", resCode: "17", saleOrderId: BigInt(2), saleReferenceId: BigInt(3) },
        clock,
        identifiers,
      ),
    );
    expect(() => handler.execute({ ...input, terminalId: BigInt(1), saleOrderId: BigInt(2), saleReferenceId: BigInt(3) })).toThrow(
      expect.objectContaining({ code: "VERIFY_SETTLE_NOT_ELIGIBLE" }),
    );
    expect(repository.getById(nonSuccess.id)).toEqual(nonSuccess);
  });

  it("does not use combined-operation orderId for Sale lookup or uniqueness", () => {
    const { repository, clock, identifiers, handler, input } = fixture();
    const second = repository.create(
      assignRefId(
        createTransaction(
          {
            terminalId: input.terminalId,
            orderId: BigInt("9007199254741995"),
            amount: BigInt(1_000),
            callBackUrl: "https://merchant.test/second",
          },
          clock,
          identifiers,
        ),
        "LocalRef-Aa2",
        clock,
        identifiers,
      ),
    );
    repository.save(recordSaleSucceeded(
      second,
      { refId: "LocalRef-Aa2", saleOrderId: BigInt("9007199254741995"), saleReferenceId: BigInt("9007199254742999") },
      clock,
      identifiers,
    ));

    expect(handler.execute(input).result).toBe("0");
    // PROTOCOL: page 32 says VerifySettle orderId need not be unique and may equal saleOrderId.
    expect(handler.execute({
      ...input,
      saleOrderId: BigInt("9007199254741995"),
      saleReferenceId: BigInt("9007199254742999"),
    }).result).toBe("0");
  });
});
