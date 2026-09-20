import { TransactionDomainError } from "./errors";
import type { Transaction } from "./transaction";

export type ProtocolCorrelation = Readonly<{
  terminalId: bigint;
  saleOrderId: bigint;
  saleReferenceId: bigint;
}>;

export interface TransactionRepository {
  create(transaction: Transaction): Transaction;
  /** SIMULATOR_INTERNAL read-only snapshot enumeration for local diagnostics. */
  list(): readonly Transaction[];
  getById(transactionId: string): Transaction | undefined;
  getByTerminalIdAndOrderId(terminalId: bigint, orderId: bigint): Transaction | undefined;
  getByRefId(refId: string): Transaction | undefined;
  getBySaleReferenceId(saleReferenceId: bigint): Transaction | undefined;
  getByProtocolCorrelation(correlation: ProtocolCorrelation): Transaction | undefined;
  save(transaction: Transaction): Transaction;
}

/** SIMULATOR_INTERNAL local repository. It is synchronous, in-memory, and replaceable. */
export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly transactions = new Map<string, Transaction>();
  private readonly paymentRequestIndex = new Map<string, string>();

  create(transaction: Transaction): Transaction {
    if (this.transactions.has(transaction.id)) {
      throw new TransactionDomainError(
        "DUPLICATE_TRANSACTION_ID",
        `Transaction ${transaction.id} already exists.`,
      );
    }

    const paymentRequestKey = keyForPaymentRequest(transaction.terminalId, transaction.orderId);
    if (this.paymentRequestIndex.has(paymentRequestKey)) {
      throw new TransactionDomainError(
        "DUPLICATE_PAY_ORDER_ID",
        `Pay orderId ${transaction.orderId} already exists for terminalId ${transaction.terminalId}.`,
      );
    }

    const snapshot = snapshotOf(transaction);
    this.transactions.set(snapshot.id, snapshot);
    this.paymentRequestIndex.set(paymentRequestKey, snapshot.id);
    return snapshotOf(snapshot);
  }

  list(): readonly Transaction[] {
    return Object.freeze([...this.transactions.values()].map((transaction) => snapshotOf(transaction)));
  }

  getById(transactionId: string): Transaction | undefined {
    const transaction = this.transactions.get(transactionId);
    return transaction === undefined ? undefined : snapshotOf(transaction);
  }

  getByTerminalIdAndOrderId(terminalId: bigint, orderId: bigint): Transaction | undefined {
    const transactionId = this.paymentRequestIndex.get(keyForPaymentRequest(terminalId, orderId));
    return transactionId === undefined ? undefined : this.getById(transactionId);
  }

  getByRefId(refId: string): Transaction | undefined {
    return findOne(this.transactions.values(), (transaction) => transaction.refId === refId);
  }

  getBySaleReferenceId(saleReferenceId: bigint): Transaction | undefined {
    return findOne(this.transactions.values(), (transaction) => transaction.saleReferenceId === saleReferenceId);
  }

  getByProtocolCorrelation(correlation: ProtocolCorrelation): Transaction | undefined {
    return findOne(
      this.transactions.values(),
      (transaction) =>
        transaction.terminalId === correlation.terminalId &&
        transaction.saleOrderId === correlation.saleOrderId &&
        transaction.saleReferenceId === correlation.saleReferenceId,
    );
  }

  save(transaction: Transaction): Transaction {
    const stored = this.transactions.get(transaction.id);
    if (stored === undefined) {
      throw new TransactionDomainError(
        "TRANSACTION_NOT_FOUND",
        `Transaction ${transaction.id} does not exist.`,
      );
    }
    if (stored.paymentOperation !== transaction.paymentOperation || stored.terminalId !== transaction.terminalId || stored.orderId !== transaction.orderId) {
      throw new TransactionDomainError(
        "IMMUTABLE_TRANSACTION_IDENTITY",
        `terminalId and orderId cannot change for transaction ${transaction.id}.`,
      );
    }

    const snapshot = snapshotOf(transaction);
    this.transactions.set(snapshot.id, snapshot);
    return snapshotOf(snapshot);
  }
}

/** SIMULATOR_INTERNAL: terminal-wide uniqueness prevents ambiguous local payment identity. */
function keyForPaymentRequest(terminalId: bigint, orderId: bigint): string {
  return `${terminalId}:${orderId}`;
}

function findOne(
  transactions: Iterable<Transaction>,
  predicate: (transaction: Transaction) => boolean,
): Transaction | undefined {
  for (const transaction of transactions) {
    if (predicate(transaction)) {
      return snapshotOf(transaction);
    }
  }
  return undefined;
}

function snapshotOf(transaction: Transaction): Transaction {
  return Object.freeze({
    ...transaction,
    events: Object.freeze(transaction.events.map((event) => Object.freeze({ ...event }))),
  });
}
