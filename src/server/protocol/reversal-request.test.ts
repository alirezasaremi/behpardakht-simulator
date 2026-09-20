import { describe, expect, it } from "vitest";
import {
  ManualClock,
  InMemoryTransactionRepository,
  SequenceIdentifierGenerator,
  assignRefId,
  createTransaction,
  recordReversalCompleted,
  recordSaleSucceeded,
  recordVerificationConfirmed,
  recordVerifyAttempted,
  recordVerifySettleRequested,
} from "@/server/transactions";
import { BpReversalRequestHandler, type BpReversalRequestInput } from "./reversal-request";
import { BpVerifyRequestHandler } from "./verify-request";

function fixture() {
  const repository = new InMemoryTransactionRepository();
  const clock = new ManualClock(new Date("2026-01-01T00:00:00.000Z"));
  const identifiers = new SequenceIdentifierGenerator();
  const created = repository.create(assignRefId(createTransaction(
    { terminalId: BigInt("9007199254740993"), orderId: BigInt("9007199254740995"), amount: BigInt(1000), callBackUrl: "https://merchant.test/callback" },
    clock, identifiers,
  ), "LocalRef-Aa1", clock, identifiers));
  const sale = repository.save(recordSaleSucceeded(
    created,
    { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
    clock, identifiers,
  ));
  const input: BpReversalRequestInput = {
    terminalId: BigInt("9007199254740993"), userName: "local-merchant", userPassword: "fake-test-password",
    orderId: BigInt("9007199254740995"), saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999"),
  };
  return { repository, clock, identifiers, sale, handler: new BpReversalRequestHandler({ repository }), input };
}

describe("BpReversalRequestHandler", () => {
  it("requires prior Verify invocation, then faults without invented provider result", () => {
    const { repository, clock, identifiers, sale, handler, input } = fixture();
    expect(() => handler.execute(input)).toThrow(expect.objectContaining({ code: "REVERSAL_PREREQUISITE_NOT_MET" }));
    const attempted = repository.save(recordVerifyAttempted(sale, clock, identifiers));
    expect(() => handler.execute(input)).toThrow(expect.objectContaining({ code: "REVERSAL_RESULT_UNSPECIFIED" }));
    expect(repository.getById(sale.id)).toEqual(attempted);
  });

  it("does not make ATTEMPTED and VERIFIED distinct provider eligibility rules", () => {
    const { repository, clock, identifiers, sale, handler, input } = fixture();
    const verified = repository.save(recordVerificationConfirmed(recordVerifyAttempted(sale, clock, identifiers), clock, identifiers));
    expect(() => handler.execute(input)).toThrow(expect.objectContaining({ code: "REVERSAL_RESULT_UNSPECIFIED" }));
    expect(repository.getById(sale.id)).toEqual(verified);
  });

  it("enforces documented settlement boundary and preserves source-backed Verify 48 state", () => {
    const settledFixture = fixture();
    const settled = settledFixture.repository.save(recordVerifySettleRequested(settledFixture.sale, settledFixture.clock, settledFixture.identifiers));
    expect(() => settledFixture.handler.execute(settledFixture.input)).toThrow(
      expect.objectContaining({ code: "REVERSAL_SETTLEMENT_REQUESTED" }),
    );
    expect(settledFixture.repository.getById(settled.id)).toEqual(settled);

    const reversedFixture = fixture();
    const attempted = reversedFixture.repository.save(recordVerifyAttempted(
      reversedFixture.sale, reversedFixture.clock, reversedFixture.identifiers,
    ));
    const reversed = reversedFixture.repository.save(recordReversalCompleted(
      attempted, reversedFixture.clock, reversedFixture.identifiers,
    ));
    const verify = new BpVerifyRequestHandler({ repository: reversedFixture.repository, clock: reversedFixture.clock, identifiers: reversedFixture.identifiers });
    expect(verify.execute(reversedFixture.input).result).toBe("48");
    expect(reversedFixture.repository.getById(reversed.id)).toEqual(reversed);
  });

  it("keeps Reversal orderId out of correlation and faults mismatches without mutation", () => {
    const { repository, sale, handler, input } = fixture();
    expect(() => handler.execute({ ...input, orderId: BigInt("9007199254741995") })).toThrow(
      expect.objectContaining({ code: "REVERSAL_PREREQUISITE_NOT_MET" }),
    );
    for (const mismatch of [{ ...input, terminalId: BigInt(1) }, { ...input, saleOrderId: BigInt(1) }, { ...input, saleReferenceId: BigInt(1) }]) {
      expect(() => handler.execute(mismatch)).toThrow(expect.objectContaining({ code: "REVERSAL_CORRELATION_NOT_FOUND" }));
    }
    expect(repository.getById(sale.id)).toEqual(sale);
  });
});
