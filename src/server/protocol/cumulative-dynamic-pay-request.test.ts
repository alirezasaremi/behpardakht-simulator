import { describe, expect, it } from "vitest";
import { InMemoryTransactionRepository, ManualClock, SequenceIdentifierGenerator } from "@/server/transactions";
import { BpCumulativeDynamicPayRequestHandler, type BpCumulativeDynamicPayRequestInput } from "./cumulative-dynamic-pay-request";
import { BpPayRequestHandler } from "./pay-request";

const input: BpCumulativeDynamicPayRequestInput = {
  terminalId: BigInt("9007199254740993"), userName: "local-merchant", userPassword: "fake-test-password",
  orderId: BigInt("9007199254740995"), amount: BigInt("900719925474099912345"), localDate: "20260101", localTime: "120000",
  additionalData: "account-one,900719925474099900000,payer-one;account-two,12345,",
  distributions: [
    { accountId: "account-one", amount: BigInt("900719925474099900000"), payerId: "payer-one" },
    { accountId: "account-two", amount: BigInt(12345), payerId: "" },
  ],
  callBackUrl: "https://merchant.test/callback",
};

function cumulative(repository = new InMemoryTransactionRepository(), identifiers = new SequenceIdentifierGenerator()) {
  let sequence = 0;
  return new BpCumulativeDynamicPayRequestHandler({
    repository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers,
    refIds: { nextRefId: () => `Cumulative-Ref-${++sequence}` },
  });
}

describe("BpCumulativeDynamicPayRequestHandler", () => {
  it("records only safe Cumulative Dynamic Pay identity and discards distributions and credentials", () => {
    const repository = new InMemoryTransactionRepository();
    const result = cumulative(repository).execute(input);
    const transaction = repository.getByRefId("Cumulative-Ref-1");

    expect(result.result).toBe("0,Cumulative-Ref-1");
    expect(transaction).toMatchObject({ paymentOperation: "CUMULATIVE_DYNAMIC_PAY", terminalId: input.terminalId, orderId: input.orderId, amount: input.amount, refId: "Cumulative-Ref-1" });
    for (const field of ["additionalData", "distributions", "userName", "userPassword"]) {
      expect(transaction).not.toHaveProperty(field);
    }
  });

  it("keeps terminal-wide local Pay-family request uniqueness", () => {
    const repository = new InMemoryTransactionRepository();
    const identifiers = new SequenceIdentifierGenerator();
    cumulative(repository, identifiers).execute(input);
    const pay = new BpPayRequestHandler({ repository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers, refIds: { nextRefId: () => "Pay-Ref-1" } });

    expect(() => pay.execute({ ...input, additionalData: "safe test", payerId: "0", mobileNo: undefined, encPan: undefined, panHiddenMode: undefined, cartItem: undefined, enc: undefined })).toThrow(
      expect.objectContaining({ code: "DUPLICATE_PAY_ORDER_ID" }),
    );
    expect(repository.list()).toHaveLength(1);
  });

  it("does not persist a pending request when local RefId allocation fails", () => {
    const repository = new InMemoryTransactionRepository();
    const handler = new BpCumulativeDynamicPayRequestHandler({
      repository,
      clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")),
      identifiers: new SequenceIdentifierGenerator(),
      refIds: { nextRefId: () => "" },
    });

    expect(() => handler.execute(input)).toThrow(expect.objectContaining({ code: "REF_ID_GENERATION_FAILED" }));
    expect(repository.list()).toEqual([]);
  });
});
