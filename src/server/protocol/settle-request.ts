import type { Clock, IdentifierGenerator, Transaction, TransactionRepository } from "@/server/transactions";
import { recordSettlementRequested } from "@/server/transactions";

/** PROTOCOL: v1.39 printed page 22, table 3, names and types. */
export type BpSettleRequestInput = Readonly<{
  terminalId: bigint;
  userName: string;
  userPassword: string;
  /** Settlement-request number. It need not be unique and may equal saleOrderId. */
  orderId: bigint;
  /** Purchase-request number: original Pay orderId. */
  saleOrderId: bigint;
  /** Purchase transaction reference used in Verify. */
  saleReferenceId: bigint;
}>;

export type BpSettleRequestHandlerDependencies = Readonly<{
  repository: TransactionRepository;
  clock: Clock;
  identifiers: IdentifierGenerator;
}>;

export type BpSettleRequestResult = Readonly<{
  /** PROTOCOL: page 22 says 0 means settlement request was received successfully. */
  result: "0";
  transaction: Transaction;
}>;

export class BpSettleRequestApplicationError extends Error {
  constructor(
    readonly code: "SETTLE_CORRELATION_NOT_FOUND" | "SETTLE_NOT_ELIGIBLE",
    message: string,
  ) {
    super(message);
    this.name = "BpSettleRequestApplicationError";
  }
}

/**
 * PROTOCOL: table 3 identifies settlement fields; verified purchase records are
 * what page 22 says are settled. Page 22 also says Settle orderId need not be
 * unique and may equal saleOrderId, so it is not used as a lookup key.
 *
 * SIMULATOR_INTERNAL: local eligibility and rejected-request faults model only
 * source-supported lifecycle ordering. Credentials are compatibility input and
 * discarded at this boundary.
 */
export class BpSettleRequestHandler {
  constructor(private readonly dependencies: BpSettleRequestHandlerDependencies) {}

  execute(input: BpSettleRequestInput): BpSettleRequestResult {
    const transaction = this.dependencies.repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });
    if (transaction === undefined) {
      throw new BpSettleRequestApplicationError(
        "SETTLE_CORRELATION_NOT_FOUND",
        "Settle correlation does not identify a completed local Sale.",
      );
    }

    if (
      transaction.verificationState !== "VERIFIED" ||
      transaction.settlementState !== "NOT_REQUESTED" ||
      transaction.reversalState !== "NOT_REQUESTED"
    ) {
      throw new BpSettleRequestApplicationError(
        "SETTLE_NOT_ELIGIBLE",
        "Settle is not eligible for this local transaction state.",
      );
    }

    // Immutable transition plus one final repository save prevents partial state.
    const settled = recordSettlementRequested(transaction, this.dependencies.clock, this.dependencies.identifiers);
    return { result: "0", transaction: this.dependencies.repository.save(settled) };
  }
}
