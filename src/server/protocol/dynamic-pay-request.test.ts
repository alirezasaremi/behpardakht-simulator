import { describe, expect, it } from "vitest";
import { InMemoryTransactionRepository, ManualClock, SequenceIdentifierGenerator } from "@/server/transactions";
import { BpDynamicPayRequestHandler, type BpDynamicPayRequestInput } from "./dynamic-pay-request";
import { BpPayRequestHandler } from "./pay-request";

const input: BpDynamicPayRequestInput = {
  terminalId: BigInt("9007199254740993"), userName: "local-merchant", userPassword: "fake-test-password",
  orderId: BigInt("9007199254740995"), amount: BigInt(1_000), localDate: "20260101", localTime: "120000",
  additionalData: "local test", callBackUrl: "https://merchant.test/callback", payerId: "0", subServiceId: BigInt("9007199254740997"),
};

function refIds() {
  let sequence = 0;
  return { nextRefId: () => `Dynamic-Ref-${++sequence}` };
}

function dynamic(repository = new InMemoryTransactionRepository(), identifiers = new SequenceIdentifierGenerator()) {
  return new BpDynamicPayRequestHandler({ repository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers, refIds: refIds() });
}

describe("BpDynamicPayRequestHandler", () => {
  it("records safe Dynamic Pay request identity, preserves bigint identifiers, and discards subservice/credentials", () => {
    const repository = new InMemoryTransactionRepository();
    const result = dynamic(repository).execute(input);
    const transaction = repository.getByRefId("Dynamic-Ref-1");

    expect(result.result).toBe("0,Dynamic-Ref-1");
    expect(transaction).toMatchObject({ paymentOperation: "DYNAMIC_PAY", terminalId: input.terminalId, orderId: input.orderId, amount: input.amount, refId: "Dynamic-Ref-1" });
    expect(transaction).not.toHaveProperty("subServiceId");
    expect(transaction).not.toHaveProperty("userName");
    expect(transaction).not.toHaveProperty("userPassword");
  });

  it("rejects Pay after same-terminal Dynamic Pay without creating a second request", () => {
    const repository = new InMemoryTransactionRepository();
    const identifiers = new SequenceIdentifierGenerator();
    const handler = dynamic(repository, identifiers);
    handler.execute(input);

    const pay = new BpPayRequestHandler({ repository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers, refIds: { nextRefId: () => "Pay-Ref-1" } });
    expect(() => pay.execute({ ...input, mobileNo: undefined, encPan: undefined, panHiddenMode: undefined, cartItem: undefined, enc: undefined })).toThrow(
      expect.objectContaining({ code: "DUPLICATE_PAY_ORDER_ID" }),
    );
    expect(repository.list()).toHaveLength(1);
  });

  it("rejects Dynamic Pay after same-terminal Pay without creating a second request", () => {
    const repository = new InMemoryTransactionRepository();
    const identifiers = new SequenceIdentifierGenerator();
    const pay = new BpPayRequestHandler({ repository, clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")), identifiers, refIds: { nextRefId: () => "Pay-Ref-1" } });
    pay.execute({ ...input, mobileNo: undefined, encPan: undefined, panHiddenMode: undefined, cartItem: undefined, enc: undefined });

    expect(() => dynamic(repository, identifiers).execute(input)).toThrow(
      expect.objectContaining({ code: "DUPLICATE_DYNAMIC_PAY_ORDER_ID" }),
    );
    expect(repository.list()).toHaveLength(1);
  });

  it("allows same orderId for a different terminal", () => {
    const repository = new InMemoryTransactionRepository();
    const identifiers = new SequenceIdentifierGenerator();
    const handler = dynamic(repository, identifiers);
    handler.execute(input);

    expect(handler.execute({ ...input, terminalId: BigInt("9007199254740994") }).result).toBe("0,Dynamic-Ref-2");
  });
});
