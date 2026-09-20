import type { Clock } from "./clock";
import { TransactionDomainError } from "./errors";
import type { IdentifierGenerator } from "./identifiers";

export type SaleState = "PENDING" | "SUCCEEDED" | "NON_SUCCESS";
export type VerificationState = "NOT_ATTEMPTED" | "ATTEMPTED" | "VERIFIED";
export type SettlementState = "NOT_REQUESTED" | "REQUESTED";
export type ReversalState = "NOT_REQUESTED" | "REQUESTED";

export type LifecycleState =
  | "AWAITING_SALE"
  | "SALE_NON_SUCCESS"
  | "SALE_SUCCEEDED"
  | "VERIFY_PENDING"
  | "VERIFIED"
  | "SETTLEMENT_REQUESTED"
  | "REVERSAL_REQUESTED";

type EventBase = Readonly<{
  id: string;
  at: string;
}>;

export type TransactionEvent =
  | (EventBase & Readonly<{
      type: "TRANSACTION_CREATED";
      terminalId: bigint;
      orderId: bigint;
      amount: bigint;
    }>)
  | (EventBase & Readonly<{ type: "REF_ID_ASSIGNED"; refId: string }>)
  | (EventBase & Readonly<{
      type: "SALE_SUCCEEDED";
      refId: string;
      saleOrderId: bigint;
      saleReferenceId: bigint;
    }>)
  | (EventBase & Readonly<{ type: "SALE_NON_SUCCESS"; resCode: string }>)
  | (EventBase & Readonly<{ type: "VERIFY_ATTEMPTED" }>)
  | (EventBase & Readonly<{ type: "VERIFICATION_CONFIRMED" }>)
  | (EventBase & Readonly<{ type: "INQUIRY_RECORDED" }>)
  | (EventBase & Readonly<{
      type: "SETTLEMENT_REQUESTED";
      via: "SETTLE" | "VERIFY_SETTLE";
    }>)
  | (EventBase & Readonly<{ type: "REVERSAL_REQUESTED" }>);

export type Transaction = Readonly<{
  /** SIMULATOR_INTERNAL identifier. */
  id: string;
  /** Documented Pay fields use their Behpardakht casing. */
  terminalId: bigint;
  orderId: bigint;
  amount: bigint;
  callBackUrl: string;
  refId?: string;
  saleOrderId?: bigint;
  saleReferenceId?: bigint;
  saleState: SaleState;
  verificationState: VerificationState;
  settlementState: SettlementState;
  reversalState: ReversalState;
  lifecycleState: LifecycleState;
  createdAt: string;
  updatedAt: string;
  saleCompletedAt?: string;
  verificationAttemptedAt?: string;
  verifiedAt?: string;
  settlementRequestedAt?: string;
  reversalRequestedAt?: string;
  events: readonly TransactionEvent[];
}>;

export type CreateTransactionInput = Readonly<{
  terminalId: bigint;
  orderId: bigint;
  amount: bigint;
  callBackUrl: string;
}>;

export type SaleSuccessInput = Readonly<{
  refId: string;
  saleOrderId: bigint;
  saleReferenceId: bigint;
}>;

export type SaleNonSuccessInput = Readonly<{
  refId: string;
  resCode: string;
}>;

export function createTransaction(
  input: CreateTransactionInput,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  const now = timestamp(clock);
  return freezeTransaction({
    id: identifiers.nextTransactionId(),
    ...input,
    saleState: "PENDING",
    verificationState: "NOT_ATTEMPTED",
    settlementState: "NOT_REQUESTED",
    reversalState: "NOT_REQUESTED",
    lifecycleState: "AWAITING_SALE",
    createdAt: now,
    updatedAt: now,
    events: [
      event(identifiers, now, "TRANSACTION_CREATED", {
        terminalId: input.terminalId,
        orderId: input.orderId,
        amount: input.amount,
      }),
    ],
  });
}

/** Records documented RefId result from a successful future Pay operation. */
export function assignRefId(
  transaction: Transaction,
  refId: string,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(transaction.saleState === "PENDING" && transaction.refId === undefined, transaction, "RefId can only be assigned once before Sale.");

  return append(transaction, clock, identifiers, "REF_ID_ASSIGNED", { refId }, { refId });
}

/** Records a successful Sale/callback correlation; no payment-page behavior exists here. */
export function recordSaleSucceeded(
  transaction: Transaction,
  input: SaleSuccessInput,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(transaction.saleState === "PENDING", transaction, "Sale result requires pending Sale.");
  requireCorrelation(transaction, input.refId, input.saleOrderId);
  const now = timestamp(clock);

  return appendAt(
    transaction,
    identifiers,
    now,
    "SALE_SUCCEEDED",
    input,
    {
      saleState: "SUCCEEDED",
      lifecycleState: "SALE_SUCCEEDED",
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
      saleCompletedAt: now,
    },
  );
}

/** Records a nonzero Sale callback result; v1.39 still documents a future Verify path. */
export function recordSaleNonSuccess(
  transaction: Transaction,
  input: SaleNonSuccessInput,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(transaction.saleState === "PENDING", transaction, "Sale result requires pending Sale.");
  require(transaction.refId === input.refId, transaction, "Sale RefId must match assigned RefId.", "PROTOCOL_CORRELATION_MISMATCH");
  const now = timestamp(clock);

  return appendAt(
    transaction,
    identifiers,
    now,
    "SALE_NON_SUCCESS",
    { resCode: input.resCode },
    {
      saleState: "NON_SUCCESS",
      lifecycleState: "SALE_NON_SUCCESS",
      saleCompletedAt: now,
    },
  );
}

/** Internal record of a future Verify request or documented retry. It does not represent a provider response. */
export function recordVerifyAttempted(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(
    (transaction.saleState === "SUCCEEDED" || transaction.saleState === "NON_SUCCESS") &&
      (transaction.verificationState === "NOT_ATTEMPTED" || transaction.verificationState === "ATTEMPTED") &&
      transaction.settlementState === "NOT_REQUESTED" &&
      transaction.reversalState === "NOT_REQUESTED",
    transaction,
    "Verify requires completed Sale callback with unresolved verification and no settlement or reversal request.",
  );
  const now = timestamp(clock);

  return appendAt(transaction, identifiers, now, "VERIFY_ATTEMPTED", {}, {
    verificationState: "ATTEMPTED",
    lifecycleState: "VERIFY_PENDING",
    verificationAttemptedAt: transaction.verificationAttemptedAt ?? now,
  });
}

/** Records successful verification result from a future protocol adapter. */
export function recordVerificationConfirmed(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(transaction.verificationState === "ATTEMPTED", transaction, "Verification confirmation requires a verification attempt.");
  const now = timestamp(clock);

  return appendAt(transaction, identifiers, now, "VERIFICATION_CONFIRMED", {}, {
    verificationState: "VERIFIED",
    lifecycleState: "VERIFIED",
    verifiedAt: now,
  });
}

/** Inquiry is event-only because source documents inquiry as status lookup, not a lifecycle outcome. */
export function recordInquiry(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(transaction.verificationState === "ATTEMPTED", transaction, "Inquiry requires an unresolved verification attempt.");
  return append(transaction, clock, identifiers, "INQUIRY_RECORDED", {}, {});
}

export function recordSettlementRequested(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(
    transaction.verificationState === "VERIFIED" && transaction.settlementState === "NOT_REQUESTED" && transaction.reversalState === "NOT_REQUESTED",
    transaction,
    "Settlement requires verified transaction with no settlement or reversal request.",
  );
  return settle(transaction, "SETTLE", clock, identifiers);
}

/** Records accepted combined Verify/Settle result; it does not implement bpVerifySettleRequest. */
export function recordVerifySettleRequested(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(
    transaction.saleState === "SUCCEEDED" && transaction.verificationState === "NOT_ATTEMPTED" && transaction.settlementState === "NOT_REQUESTED" && transaction.reversalState === "NOT_REQUESTED",
    transaction,
    "VerifySettle requires successful Sale with no later lifecycle request.",
  );
  const now = timestamp(clock);

  return appendAt(
    transaction,
    identifiers,
    now,
    "SETTLEMENT_REQUESTED",
    { via: "VERIFY_SETTLE" },
    {
      verificationState: "VERIFIED",
      verifiedAt: now,
      settlementState: "REQUESTED",
      lifecycleState: "SETTLEMENT_REQUESTED",
      settlementRequestedAt: now,
    },
  );
}

/** Records future reversal request ordering only; provider acceptance remains protocol-adapter work. */
export function recordReversalRequested(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(
    (transaction.saleState === "SUCCEEDED" || transaction.saleState === "NON_SUCCESS") &&
      (transaction.verificationState === "ATTEMPTED" || transaction.verificationState === "VERIFIED") &&
      transaction.settlementState === "NOT_REQUESTED" &&
      transaction.reversalState === "NOT_REQUESTED",
    transaction,
    "Reversal requires successful Sale after Verify attempt and before settlement or reversal request.",
  );
  const now = timestamp(clock);

  return appendAt(transaction, identifiers, now, "REVERSAL_REQUESTED", {}, {
    reversalState: "REQUESTED",
    lifecycleState: "REVERSAL_REQUESTED",
    reversalRequestedAt: now,
  });
}

function settle(
  transaction: Transaction,
  via: "SETTLE",
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  const now = timestamp(clock);
  return appendAt(transaction, identifiers, now, "SETTLEMENT_REQUESTED", { via }, {
    settlementState: "REQUESTED",
    lifecycleState: "SETTLEMENT_REQUESTED",
    settlementRequestedAt: now,
  });
}

function requireCorrelation(transaction: Transaction, refId: string, saleOrderId: bigint): void {
  require(transaction.refId === refId, transaction, "Sale RefId must match assigned RefId.", "PROTOCOL_CORRELATION_MISMATCH");
  require(transaction.orderId === saleOrderId, transaction, "SaleOrderId must match Pay orderId.", "PROTOCOL_CORRELATION_MISMATCH");
}

function require(
  condition: boolean,
  transaction: Transaction,
  message: string,
  code: "INVALID_TRANSACTION_TRANSITION" | "PROTOCOL_CORRELATION_MISMATCH" = "INVALID_TRANSACTION_TRANSITION",
): asserts condition {
  if (!condition) {
    throw new TransactionDomainError(code, `${message} Transaction ${transaction.id} is ${transaction.lifecycleState}.`);
  }
}

function append<TType extends TransactionEvent["type"]>(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
  type: TType,
  details: EventDetails<TType>,
  changes: Partial<Transaction>,
): Transaction {
  return appendAt(transaction, identifiers, timestamp(clock), type, details, changes);
}

function appendAt<TType extends TransactionEvent["type"]>(
  transaction: Transaction,
  identifiers: IdentifierGenerator,
  at: string,
  type: TType,
  details: EventDetails<TType>,
  changes: Partial<Transaction>,
): Transaction {
  return freezeTransaction({
    ...transaction,
    ...changes,
    updatedAt: at,
    events: [...transaction.events, event(identifiers, at, type, details)],
  });
}

type EventDetails<TType extends TransactionEvent["type"]> = Omit<
  Extract<TransactionEvent, { type: TType }>,
  "id" | "at" | "type"
>;

function event<TType extends TransactionEvent["type"]>(
  identifiers: IdentifierGenerator,
  at: string,
  type: TType,
  details: EventDetails<TType>,
): Extract<TransactionEvent, { type: TType }> {
  return Object.freeze({
    id: identifiers.nextEventId(),
    at,
    type,
    ...details,
  }) as Extract<TransactionEvent, { type: TType }>;
}

function timestamp(clock: Clock): string {
  return clock.now().toISOString();
}

function freezeTransaction(transaction: Transaction): Transaction {
  return Object.freeze({
    ...transaction,
    events: Object.freeze([...transaction.events]),
  });
}
