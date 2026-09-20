import type { Clock } from "./clock";
import { TransactionDomainError } from "./errors";
import type { IdentifierGenerator } from "./identifiers";

export type SaleState = "PENDING" | "SUCCEEDED" | "NON_SUCCESS";
export type VerificationState = "NOT_ATTEMPTED" | "ATTEMPTED" | "VERIFIED";
export type SettlementState = "NOT_REQUESTED" | "REQUESTED";
export type ReversalState = "NOT_REVERSED" | "REVERSED";
/** SIMULATOR_INTERNAL local request categories based on documented operation names. */
export type PaymentOperation = "PAY" | "DYNAMIC_PAY";

export type LifecycleState =
  | "AWAITING_SALE"
  | "SALE_NON_SUCCESS"
  | "SALE_SUCCEEDED"
  | "VERIFY_PENDING"
  | "VERIFIED"
  | "SETTLEMENT_REQUESTED"
  | "REVERSED";

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
  | (EventBase & Readonly<{
      type: "SALE_NON_SUCCESS";
      refId: string;
      resCode: string;
      saleOrderId: bigint;
      saleReferenceId: bigint;
    }>)
  | (EventBase & Readonly<{ type: "CALLBACK_DISPATCH_ATTEMPTED" }>)
  | (EventBase & Readonly<{ type: "CALLBACK_DISPATCH_SUCCEEDED"; httpStatus: number }>)
  | (EventBase & Readonly<{
      type: "CALLBACK_DISPATCH_FAILED";
      reason: "DESTINATION_REJECTED" | "HTTP_NON_SUCCESS" | "TIMEOUT" | "TRANSPORT_ERROR";
      httpStatus?: number;
    }>)
  | (EventBase & Readonly<{ type: "VERIFY_ATTEMPTED" }>)
  | (EventBase & Readonly<{ type: "VERIFICATION_CONFIRMED" }>)
  | (EventBase & Readonly<{
      type: "SETTLEMENT_REQUESTED";
      via: "SETTLE" | "VERIFY_SETTLE";
    }>)
  | (EventBase & Readonly<{
      /** SIMULATOR_SCENARIO: local control action, never a Behpardakht call. */
      type: "SCENARIO_STATE_FORCED";
      scenario: "KNOWN_REVERSED";
    }>)
  | (EventBase & Readonly<{ type: "REVERSAL_COMPLETED" }>);

export type Transaction = Readonly<{
  /** SIMULATOR_INTERNAL identifier. */
  id: string;
  /** SIMULATOR_INTERNAL operation identity; no provider wire behavior is implied by storage. */
  paymentOperation: PaymentOperation;
  /** Documented Pay fields use their Behpardakht casing. */
  terminalId: bigint;
  orderId: bigint;
  amount: bigint;
  callBackUrl: string;
  refId?: string;
  saleOrderId?: bigint;
  saleReferenceId?: bigint;
  saleResCode?: string;
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
  reversedAt?: string;
  events: readonly TransactionEvent[];
}>;

export type CreateTransactionInput = Readonly<{
  paymentOperation?: PaymentOperation;
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
  saleOrderId: bigint;
  saleReferenceId: bigint;
}>;

export function createTransaction(
  input: CreateTransactionInput,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  const now = timestamp(clock);
  return freezeTransaction({
    id: identifiers.nextTransactionId(),
    paymentOperation: input.paymentOperation ?? "PAY",
    ...input,
    saleState: "PENDING",
    verificationState: "NOT_ATTEMPTED",
    settlementState: "NOT_REQUESTED",
    reversalState: "NOT_REVERSED",
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
      saleResCode: "0",
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
  requireCorrelation(transaction, input.refId, input.saleOrderId);
  const now = timestamp(clock);

  return appendAt(
    transaction,
    identifiers,
    now,
    "SALE_NON_SUCCESS",
    input,
    {
      saleState: "NON_SUCCESS",
      lifecycleState: "SALE_NON_SUCCESS",
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
      saleResCode: input.resCode,
      saleCompletedAt: now,
    },
  );
}

/** SIMULATOR_INTERNAL callback transport diagnostics. They never change Sale state. */
export function recordCallbackDispatchAttempted(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(
    transaction.saleState === "SUCCEEDED" || transaction.saleState === "NON_SUCCESS",
    transaction,
    "Callback dispatch requires completed Sale.",
  );
  return append(transaction, clock, identifiers, "CALLBACK_DISPATCH_ATTEMPTED", {}, {});
}

/** SIMULATOR_INTERNAL callback transport diagnostic. */
export function recordCallbackDispatchSucceeded(
  transaction: Transaction,
  httpStatus: number,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  return append(transaction, clock, identifiers, "CALLBACK_DISPATCH_SUCCEEDED", { httpStatus }, {});
}

/** SIMULATOR_INTERNAL callback transport diagnostic. */
export function recordCallbackDispatchFailed(
  transaction: Transaction,
  reason: "DESTINATION_REJECTED" | "HTTP_NON_SUCCESS" | "TIMEOUT" | "TRANSPORT_ERROR",
  httpStatus: number | undefined,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  return append(
    transaction,
    clock,
    identifiers,
    "CALLBACK_DISPATCH_FAILED",
    httpStatus === undefined ? { reason } : { reason, httpStatus },
    {},
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
      transaction.reversalState === "NOT_REVERSED",
    transaction,
    "Verify requires completed Sale callback with unresolved verification and no settlement or completed reversal.",
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

export function recordSettlementRequested(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(
    transaction.verificationState === "VERIFIED" && transaction.settlementState === "NOT_REQUESTED",
    transaction,
    "Settlement requires verified transaction with no settlement or completed reversal.",
  );
  return settle(transaction, "SETTLE", clock, identifiers);
}

/** Records accepted combined Verify/Settle result for bpVerifySettleRequest. */
export function recordVerifySettleRequested(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(
    transaction.saleState === "SUCCEEDED" &&
      transaction.verificationState === "NOT_ATTEMPTED" &&
      transaction.settlementState === "NOT_REQUESTED" &&
      transaction.reversalState === "NOT_REVERSED",
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

/**
 * SIMULATOR_INTERNAL representation of known reversed state. It is not invoked
 * by bpReversalRequest: v1.39 does not map that operation's result to this
 * completed state.
 */
export function recordReversalCompleted(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(
      (transaction.saleState === "SUCCEEDED" || transaction.saleState === "NON_SUCCESS") &&
      transaction.verificationState === "ATTEMPTED" &&
      transaction.settlementState === "NOT_REQUESTED" &&
      transaction.reversalState === "NOT_REVERSED",
    transaction,
    "Reversal requires an unresolved Verify attempt and no settlement or completed reversal.",
  );
  const now = timestamp(clock);

  return appendAt(transaction, identifiers, now, "REVERSAL_COMPLETED", {}, {
    reversalState: "REVERSED",
    lifecycleState: "REVERSED",
    reversedAt: now,
  });
}

/**
 * SIMULATOR_SCENARIO: records a locally forced known-reversed lifecycle fact.
 * It is intentionally distinct from REVERSAL_COMPLETED and bpReversalRequest.
 */
export function recordScenarioKnownReversed(
  transaction: Transaction,
  clock: Clock,
  identifiers: IdentifierGenerator,
): Transaction {
  require(
    transaction.saleState === "SUCCEEDED" &&
      (transaction.verificationState === "NOT_ATTEMPTED" || transaction.verificationState === "ATTEMPTED") &&
      transaction.settlementState === "NOT_REQUESTED" &&
      transaction.reversalState === "NOT_REVERSED",
    transaction,
    "Known reversed scenario requires successful Sale with unresolved verification and no settlement.",
  );
  const now = timestamp(clock);

  return appendAt(transaction, identifiers, now, "SCENARIO_STATE_FORCED", { scenario: "KNOWN_REVERSED" }, {
    reversalState: "REVERSED",
    lifecycleState: "REVERSED",
    reversedAt: now,
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
  /**
   * PROTOCOL: v1.39 printed page 11 says Sale-stage orderId becomes SaleOrderId;
   * printed page 33 requires callback OrderId match Pay's sent OrderId.
   */
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
