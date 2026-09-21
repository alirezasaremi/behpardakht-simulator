import { describe, expect, it } from "vitest";
import {
  ManualClock,
  InMemoryTransactionRepository,
  SequenceIdentifierGenerator,
  TransactionDomainError,
  type TransactionRepository,
} from "@/server/transactions";
import {
  BpPayRequestHandler,
  formatSuccessfulPayResult,
  type BpPayRequestInput,
  type RefIdGenerator,
} from "./pay-request";

const input: BpPayRequestInput = {
  terminalId: BigInt("9007199254740993"),
  userName: "local-merchant",
  userPassword: "fake-test-password",
  orderId: BigInt("9007199254740995"),
  amount: BigInt(1_000),
  localDate: "20260101",
  localTime: "120000",
  additionalData: "local test",
  callBackUrl: "https://merchant.test/callback",
  payerId: "0",
};

class FixedRefIdGenerator implements RefIdGenerator {
  private sequence = 0;

  constructor(private readonly value: string) {}

  nextRefId(): string {
    this.sequence += 1;
    return this.sequence === 1 ? this.value : `${this.value}-${this.sequence}`;
  }
}

function handler(repository: TransactionRepository = new InMemoryTransactionRepository(), refId = "Ref-Mixed-Case"): BpPayRequestHandler {
  return new BpPayRequestHandler({
    repository,
    clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")),
    identifiers: new SequenceIdentifierGenerator(),
    refIds: new FixedRefIdGenerator(refId),
  });
}

describe("BpPayRequestHandler", () => {
  it("creates transaction, assigns deterministic case-preserved RefId, and never persists password", () => {
    const repository = new InMemoryTransactionRepository();
    const result = handler(repository).execute(input);
    const transaction = repository.getByRefId("Ref-Mixed-Case");

    expect(result.result).toBe("0,Ref-Mixed-Case");
    expect(transaction).toMatchObject({
      terminalId: BigInt("9007199254740993"),
      orderId: BigInt("9007199254740995"),
      amount: BigInt(1_000),
      callBackUrl: "https://merchant.test/callback",
      refId: "Ref-Mixed-Case",
    });
    expect(transaction?.events.map((event) => event.type)).toEqual(["TRANSACTION_CREATED", "REF_ID_ASSIGNED"]);
    expect("userPassword" in (transaction ?? {})).toBe(false);
    expect(transaction?.events.every((event) => !("userPassword" in event))).toBe(true);
  });

  it("enforces Pay orderId uniqueness per terminal without inventing a provider response code", () => {
    const repository = new InMemoryTransactionRepository();
    const pay = handler(repository);

    expect(pay.execute(input).result).toBe("0,Ref-Mixed-Case");
    expect(() => pay.execute(input)).toThrow(
      expect.objectContaining({ code: "DUPLICATE_PAY_ORDER_ID" }),
    );
    expect(pay.execute({ ...input, terminalId: BigInt(7) }).result).toBe("0,Ref-Mixed-Case-2");
  });

  it("does not turn internal domain failures into provider codes", () => {
    const failingRepository = {
      getByTerminalIdAndOrderId: () => undefined,
      getByRefId: () => undefined,
      create: () => {
        throw new TransactionDomainError("INVALID_TRANSACTION_TRANSITION", "forced test failure");
      },
    } as unknown as TransactionRepository;

    expect(() => handler(failingRepository).execute(input)).toThrow(
      expect.objectContaining({ code: "INVALID_TRANSACTION_TRANSITION" }),
    );
  });

  it("does not persist a pending transaction when local RefId allocation fails", () => {
    const repository = new InMemoryTransactionRepository();
    const pay = new BpPayRequestHandler({
      repository,
      clock: new ManualClock(new Date("2026-01-01T00:00:00.000Z")),
      identifiers: new SequenceIdentifierGenerator(),
      refIds: { nextRefId: () => "" },
    });

    expect(() => pay.execute(input)).toThrow(expect.objectContaining({ code: "REF_ID_GENERATION_FAILED" }));
    expect(repository.list()).toEqual([]);
  });
});

describe("formatSuccessfulPayResult", () => {
  it("uses documented success shape without changing RefId case", () => {
    expect(formatSuccessfulPayResult("AbC-Ref")).toBe("0,AbC-Ref");
  });
});
