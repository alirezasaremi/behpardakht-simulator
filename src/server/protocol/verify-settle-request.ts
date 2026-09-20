import type { Clock, IdentifierGenerator, Transaction, TransactionRepository } from "@/server/transactions";
import { recordVerifySettleRequested } from "@/server/transactions";

/** PROTOCOL: v1.39 printed pages 31-32, table 12 names and types. */
export type BpVerifySettleRequestInput = Readonly<{
  terminalId: bigint;
  userName: string;
  userPassword: string;
  /** Combined Verify/Settle request number. It need not be unique and may equal saleOrderId. */
  orderId: bigint;
  /** Purchase-request number: original Pay orderId. */
  saleOrderId: bigint;
  /** Bank-provided purchase transaction reference. */
  saleReferenceId: bigint;
}>;

export type BpVerifySettleRequestHandlerDependencies = Readonly<{
  repository: TransactionRepository;
  clock: Clock;
  identifiers: IdentifierGenerator;
}>;

export type BpVerifySettleRequestResult = Readonly<{
  /** PROTOCOL: pages 31-32 directly name success, prior Verify, Settle, or Reversal. */
  result: "0" | "43" | "45" | "48";
  transaction: Transaction;
}>;

export class BpVerifySettleRequestApplicationError extends Error {
  constructor(
    readonly code: "VERIFY_SETTLE_CORRELATION_NOT_FOUND" | "VERIFY_SETTLE_NOT_ELIGIBLE",
    message: string,
  ) {
    super(message);
    this.name = "BpVerifySettleRequestApplicationError";
  }
}

/**
 * PROTOCOL: pages 31-32 table 12 specifies inputs; its retry note directly
 * names successful, previously verified, settled, and reversed outcomes.
 * Table 11 supplies their numeric codes. `orderId` is not a lookup key.
 *
 * SIMULATOR_INTERNAL: successful combined work is one immutable transition and
 * one `SETTLEMENT_REQUESTED` event marked `via: "VERIFY_SETTLE"`. Credentials
 * are compatibility input and discarded at this boundary.
 */
export class BpVerifySettleRequestHandler {
  constructor(private readonly dependencies: BpVerifySettleRequestHandlerDependencies) {}

  execute(input: BpVerifySettleRequestInput): BpVerifySettleRequestResult {
    const transaction = this.dependencies.repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });
    if (transaction === undefined) {
      throw new BpVerifySettleRequestApplicationError(
        "VERIFY_SETTLE_CORRELATION_NOT_FOUND",
        "VerifySettle correlation does not identify a completed local Sale.",
      );
    }

    // PROTOCOL: page 32 names each state for a repeated VerifySettle call;
    // table 11 maps them to 48, 45, and 43 respectively.
    if (transaction.reversalState === "REVERSED") {
      return { result: "48", transaction };
    }
    if (transaction.settlementState === "REQUESTED") {
      return { result: "45", transaction };
    }
    if (transaction.verificationState === "VERIFIED") {
      return { result: "43", transaction };
    }
    if (transaction.saleState !== "SUCCEEDED" || transaction.verificationState !== "NOT_ATTEMPTED") {
      throw new BpVerifySettleRequestApplicationError(
        "VERIFY_SETTLE_NOT_ELIGIBLE",
        "VerifySettle is not eligible for this local transaction state.",
      );
    }

    // One immutable transition and one repository save prevent half-completed
    // verification/settlement state from becoming observable to callers.
    const verifySettled = recordVerifySettleRequested(
      transaction,
      this.dependencies.clock,
      this.dependencies.identifiers,
    );
    return { result: "0", transaction: this.dependencies.repository.save(verifySettled) };
  }
}
