export type TransactionDomainErrorCode =
  | "INVALID_TRANSACTION_TRANSITION"
  | "PROTOCOL_CORRELATION_MISMATCH"
  | "DUPLICATE_TRANSACTION_ID"
  | "DUPLICATE_PAY_ORDER_ID"
  | "TRANSACTION_NOT_FOUND"
  | "IMMUTABLE_TRANSACTION_IDENTITY";

export class TransactionDomainError extends Error {
  constructor(
    readonly code: TransactionDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TransactionDomainError";
  }
}
