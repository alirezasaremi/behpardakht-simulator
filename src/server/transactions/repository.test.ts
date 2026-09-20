import { describe, expect, it } from "vitest";
import { ManualClock } from "./clock";
import { SequenceIdentifierGenerator } from "./identifiers";
import { InMemoryTransactionRepository } from "./repository";
import { assignRefId, createTransaction, recordSaleSucceeded } from "./transaction";

function transactionFor(
  terminalId: bigint,
  orderId: bigint,
  identifiers = new SequenceIdentifierGenerator(),
) {
  const clock = new ManualClock(new Date("2026-01-01T00:00:00.000Z"));
  const transaction = createTransaction(
    { terminalId, orderId, amount: BigInt(1_000), callBackUrl: "https://merchant.test/callback" },
    clock,
    identifiers,
  );
  return { clock, identifiers, transaction };
}

describe("InMemoryTransactionRepository", () => {
  it("creates and retrieves isolated snapshots by simulator ID and Pay correlation", () => {
    const repository = new InMemoryTransactionRepository();
    const first = transactionFor(BigInt(10), BigInt(20)).transaction;
    const stored = repository.create(first);
    const byId = repository.getById(first.id);
    const byPayOrder = repository.getByTerminalIdAndOrderId(BigInt(10), BigInt(20));

    expect(stored).not.toBe(first);
    expect(byId).toEqual(first);
    expect(byPayOrder).toEqual(first);
    expect(repository.getByTerminalIdAndOrderId(BigInt(10), BigInt(21))).toBeUndefined();
    expect(Object.isFrozen(byId)).toBe(true);
    expect(Object.isFrozen(byId?.events)).toBe(true);
  });

  it("enforces documented Pay orderId uniqueness within terminal context", () => {
    const repository = new InMemoryTransactionRepository();
    const identifiers = new SequenceIdentifierGenerator();
    const first = transactionFor(BigInt(10), BigInt(20), identifiers).transaction;
    const duplicate = transactionFor(BigInt(10), BigInt(20), identifiers).transaction;
    const sameOrderDifferentTerminal = transactionFor(BigInt(11), BigInt(20), identifiers).transaction;

    repository.create(first);
    expect(() => repository.create(duplicate)).toThrow(expect.objectContaining({ code: "DUPLICATE_PAY_ORDER_ID" }));
    expect(() => repository.create(sameOrderDifferentTerminal)).not.toThrow();
  });

  it("finds saved transaction by RefId and complete future-operation correlation", () => {
    const repository = new InMemoryTransactionRepository();
    const { clock, identifiers, transaction } = transactionFor(BigInt(10), BigInt(20));
    repository.create(transaction);
    const withRefId = assignRefId(transaction, "Ref-A", clock, identifiers);
    const sold = recordSaleSucceeded(
      withRefId,
      { refId: "Ref-A", saleOrderId: BigInt(20), saleReferenceId: BigInt(99) },
      clock,
      identifiers,
    );
    repository.save(sold);

    expect(repository.getByRefId("Ref-A")).toEqual(sold);
    expect(
      repository.getByProtocolCorrelation({ terminalId: BigInt(10), saleOrderId: BigInt(20), saleReferenceId: BigInt(99) }),
    ).toEqual(sold);
    expect(
      repository.getByProtocolCorrelation({ terminalId: BigInt(10), saleOrderId: BigInt(20), saleReferenceId: BigInt(100) }),
    ).toBeUndefined();
  });

  it("rejects saving unknown transaction and mutable protocol identity", () => {
    const repository = new InMemoryTransactionRepository();
    const { transaction } = transactionFor(BigInt(10), BigInt(20));

    expect(() => repository.save(transaction)).toThrow(expect.objectContaining({ code: "TRANSACTION_NOT_FOUND" }));
    repository.create(transaction);
    const modifiedIdentity = { ...transaction, terminalId: BigInt(11) };
    expect(() => repository.save(modifiedIdentity)).toThrow(
      expect.objectContaining({ code: "IMMUTABLE_TRANSACTION_IDENTITY" }),
    );
  });

  it("keeps distinct transactions and their histories isolated", () => {
    const repository = new InMemoryTransactionRepository();
    const identifiers = new SequenceIdentifierGenerator();
    const first = transactionFor(BigInt(10), BigInt(20), identifiers).transaction;
    const second = transactionFor(BigInt(10), BigInt(21), identifiers).transaction;
    repository.create(first);
    repository.create(second);

    expect(repository.getById(first.id)?.orderId).toBe(BigInt(20));
    expect(repository.getById(second.id)?.orderId).toBe(BigInt(21));
    expect(repository.getById(first.id)?.events).toHaveLength(1);
    expect(repository.getById(second.id)?.events).toHaveLength(1);
  });
});
