import { describe, expect, it } from "vitest";
import { ManualClock } from "./clock";
import { TransactionDomainError } from "./errors";
import { SequenceIdentifierGenerator } from "./identifiers";
import {
  assignRefId,
  createTransaction,
  recordReversalCompleted,
  recordSaleNonSuccess,
  recordSaleSucceeded,
  recordSettlementRequested,
  recordVerificationConfirmed,
  recordVerifyAttempted,
  recordVerifySettleRequested,
} from "./transaction";

const startedAt = new Date("2026-01-01T00:00:00.000Z");

function fixture() {
  const clock = new ManualClock(startedAt);
  const identifiers = new SequenceIdentifierGenerator();
  const transaction = createTransaction(
    {
      terminalId: BigInt(10),
      orderId: BigInt(20),
      amount: BigInt(30_000),
      callBackUrl: "https://merchant.test/callback",
    },
    clock,
    identifiers,
  );
  return { clock, identifiers, transaction };
}

function saleSucceeded() {
  const context = fixture();
  context.clock.advanceBy(1_000);
  const withRefId = assignRefId(context.transaction, "Ref-A", context.clock, context.identifiers);
  context.clock.advanceBy(1_000);
  const transaction = recordSaleSucceeded(
    withRefId,
    { refId: "Ref-A", saleOrderId: BigInt(20), saleReferenceId: BigInt(99) },
    context.clock,
    context.identifiers,
  );
  return { ...context, transaction };
}

describe("transaction lifecycle", () => {
  it("creates immutable pending transaction with first event", () => {
    const { transaction } = fixture();

    expect(transaction).toMatchObject({
      id: "txn_test_1",
      saleState: "PENDING",
      verificationState: "NOT_ATTEMPTED",
      settlementState: "NOT_REQUESTED",
      reversalState: "NOT_REVERSED",
      lifecycleState: "AWAITING_SALE",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(transaction.events).toEqual([
      expect.objectContaining({
        id: "evt_test_1",
        type: "TRANSACTION_CREATED",
        terminalId: BigInt(10),
        orderId: BigInt(20),
        amount: BigInt(30_000),
      }),
    ]);
    expect(Object.isFrozen(transaction)).toBe(true);
    expect(Object.isFrozen(transaction.events)).toBe(true);
  });

  it("assigns RefId once and leaves original snapshot unchanged", () => {
    const { clock, identifiers, transaction } = fixture();
    clock.advanceBy(1_000);
    const updated = assignRefId(transaction, "Ref-A", clock, identifiers);

    expect(updated.refId).toBe("Ref-A");
    expect(updated.events.map((event) => event.type)).toEqual([
      "TRANSACTION_CREATED",
      "REF_ID_ASSIGNED",
    ]);
    expect(updated.events.at(-1)?.at).toBe("2026-01-01T00:00:01.000Z");
    expect(transaction.refId).toBeUndefined();
    expect(transaction.events).toHaveLength(1);
    expect(() => assignRefId(updated, "Ref-B", clock, identifiers)).toThrow(TransactionDomainError);
  });

  it("records successful Sale only with documented RefId and SaleOrderId correlation", () => {
    const { transaction } = saleSucceeded();

    expect(transaction).toMatchObject({
      refId: "Ref-A",
      saleOrderId: BigInt(20),
      saleReferenceId: BigInt(99),
      saleState: "SUCCEEDED",
      lifecycleState: "SALE_SUCCEEDED",
      saleCompletedAt: "2026-01-01T00:00:02.000Z",
    });
    expect(transaction.events.at(-1)).toEqual(
      expect.objectContaining({ type: "SALE_SUCCEEDED", refId: "Ref-A", saleOrderId: BigInt(20) }),
    );
  });

  it("rejects mismatched Sale correlation without changing prior snapshot", () => {
    const { clock, identifiers, transaction } = fixture();
    const withRefId = assignRefId(transaction, "Ref-A", clock, identifiers);

    expect(() =>
      recordSaleSucceeded(
        withRefId,
        { refId: "Ref-B", saleOrderId: BigInt(20), saleReferenceId: BigInt(99) },
        clock,
        identifiers,
      ),
    ).toThrow(expect.objectContaining({ code: "PROTOCOL_CORRELATION_MISMATCH" }));
    expect(withRefId.lifecycleState).toBe("AWAITING_SALE");
    expect(withRefId.events).toHaveLength(2);
  });

  it("rejects SaleOrderId that differs from Pay orderId", () => {
    const { clock, identifiers, transaction } = fixture();
    const withRefId = assignRefId(transaction, "Ref-A", clock, identifiers);

    expect(() =>
      recordSaleSucceeded(
        withRefId,
        { refId: "Ref-A", saleOrderId: BigInt(21), saleReferenceId: BigInt(99) },
        clock,
        identifiers,
      ),
    ).toThrow(expect.objectContaining({ code: "PROTOCOL_CORRELATION_MISMATCH" }));
  });

  it("records non-success Sale callback and still permits documented Verify path", () => {
    const { clock, identifiers, transaction } = fixture();
    const withRefId = assignRefId(transaction, "Ref-A", clock, identifiers);
    clock.advanceBy(1_000);
    const nonSuccess = recordSaleNonSuccess(
      withRefId,
      { refId: "Ref-A", resCode: "17", saleOrderId: BigInt(20), saleReferenceId: BigInt(99) },
      clock,
      identifiers,
    );

    expect(nonSuccess.lifecycleState).toBe("SALE_NON_SUCCESS");
    expect(nonSuccess.events.at(-1)).toEqual(expect.objectContaining({ type: "SALE_NON_SUCCESS", resCode: "17" }));
    expect(recordVerifyAttempted(nonSuccess, clock, identifiers).lifecycleState).toBe("VERIFY_PENDING");
    expect(() =>
      recordSaleNonSuccess(
        nonSuccess,
        { refId: "Ref-A", resCode: "17", saleOrderId: BigInt(20), saleReferenceId: BigInt(99) },
        clock,
        identifiers,
      ),
    ).toThrow(
      TransactionDomainError,
    );
  });

  it("records Verify, confirmation, and Settle in order with deterministic timestamps", () => {
    const { clock, identifiers, transaction } = saleSucceeded();
    clock.advanceBy(1_000);
    const verifyAttempted = recordVerifyAttempted(transaction, clock, identifiers);
    clock.advanceBy(1_000);
    const verified = recordVerificationConfirmed(verifyAttempted, clock, identifiers);
    clock.advanceBy(1_000);
    const settled = recordSettlementRequested(verified, clock, identifiers);

    expect(settled.lifecycleState).toBe("SETTLEMENT_REQUESTED");
    expect(settled.verificationState).toBe("VERIFIED");
    expect(settled.settlementState).toBe("REQUESTED");
    expect(settled.events.map((event) => event.type)).toEqual([
      "TRANSACTION_CREATED",
      "REF_ID_ASSIGNED",
      "SALE_SUCCEEDED",
      "VERIFY_ATTEMPTED",
      "VERIFICATION_CONFIRMED",
      "SETTLEMENT_REQUESTED",
    ]);
    expect(settled.settlementRequestedAt).toBe("2026-01-01T00:00:05.000Z");
  });

  it("records repeated Verify attempts while outcome remains unresolved", () => {
    const { clock, identifiers, transaction } = saleSucceeded();
    const verifyAttempted = recordVerifyAttempted(transaction, clock, identifiers);
    clock.advanceBy(1_000);
    const retried = recordVerifyAttempted(verifyAttempted, clock, identifiers);

    expect(retried.lifecycleState).toBe("VERIFY_PENDING");
    expect(retried.events.filter((event) => event.type === "VERIFY_ATTEMPTED")).toHaveLength(2);
    expect(() => recordSettlementRequested(retried, clock, identifiers)).toThrow(TransactionDomainError);
    const verified = recordVerificationConfirmed(retried, clock, identifiers);
    expect(() => recordVerifyAttempted(verified, clock, identifiers)).toThrow(TransactionDomainError);
  });

  it("records combined VerifySettle as an atomic state transition", () => {
    const { clock, identifiers, transaction } = saleSucceeded();
    clock.advanceBy(1_000);
    const verifySettled = recordVerifySettleRequested(transaction, clock, identifiers);

    expect(verifySettled).toMatchObject({
      verificationState: "VERIFIED",
      settlementState: "REQUESTED",
      lifecycleState: "SETTLEMENT_REQUESTED",
    });
    expect(verifySettled.events.at(-1)).toEqual(
      expect.objectContaining({ type: "SETTLEMENT_REQUESTED", via: "VERIFY_SETTLE" }),
    );
  });

  it("represents known reversed state without erasing prior history", () => {
    const { clock, identifiers, transaction } = saleSucceeded();
    const verifyAttempted = recordVerifyAttempted(transaction, clock, identifiers);
    clock.advanceBy(1_000);
    const reversed = recordReversalCompleted(verifyAttempted, clock, identifiers);

    expect(reversed.lifecycleState).toBe("REVERSED");
    expect(reversed.reversalState).toBe("REVERSED");
    expect(reversed.events.map((event) => event.type)).toEqual([
      "TRANSACTION_CREATED",
      "REF_ID_ASSIGNED",
      "SALE_SUCCEEDED",
      "VERIFY_ATTEMPTED",
      "REVERSAL_COMPLETED",
    ]);
    expect(() => recordSettlementRequested(reversed, clock, identifiers)).toThrow(TransactionDomainError);
    expect(() => recordReversalCompleted(reversed, clock, identifiers)).toThrow(TransactionDomainError);
  });

  it("keeps simulator known-reversed representation constrained", () => {
    const { clock, identifiers, transaction } = saleSucceeded();
    const verified = recordVerificationConfirmed(recordVerifyAttempted(transaction, clock, identifiers), clock, identifiers);

    expect(() => recordReversalCompleted(verified, clock, identifiers)).toThrow(TransactionDomainError);
  });
});

describe("ManualClock", () => {
  it("returns independent Date values and advances without real waiting", () => {
    const clock = new ManualClock(startedAt);
    const first = clock.now();
    first.setUTCFullYear(2040);
    clock.advanceBy(60_000);

    expect(clock.now().toISOString()).toBe("2026-01-01T00:01:00.000Z");
  });
});
