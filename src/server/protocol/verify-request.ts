import type { Clock, IdentifierGenerator, Transaction, TransactionRepository } from "@/server/transactions";
import { recordVerificationConfirmed, recordVerifyAttempted } from "@/server/transactions";

/** PROTOCOL: v1.39 printed page 21 table 2 names and types. */
export type BpVerifyRequestInput = Readonly<{
  terminalId: bigint;
  userName: string;
  userPassword: string;
  /** Verification-request number. It need not be unique and may equal saleOrderId. */
  orderId: bigint;
  /** Purchase-request number: original Pay orderId. */
  saleOrderId: bigint;
  /** Bank-provided Sale reference. */
  saleReferenceId: bigint;
}>;

export type BpVerifyRequestHandlerDependencies = Readonly<{
  repository: TransactionRepository;
  clock: Clock;
  identifiers: IdentifierGenerator;
}>;

export type BpVerifyRequestResult = Readonly<{
  /** PROTOCOL: 0 success; 43 prior Verify; 48 completed Reversal. */
  result: "0" | "43" | "48";
  transaction: Transaction;
}>;

export class BpVerifyRequestApplicationError extends Error {
  constructor(
    readonly code: "VERIFY_CORRELATION_NOT_FOUND" | "VERIFY_NOT_ELIGIBLE",
    message: string,
  ) {
    super(message);
    this.name = "BpVerifyRequestApplicationError";
  }
}

/**
 * PROTOCOL: success is response code 0; table 11 code 43 means a prior Verify
 * succeeded. Input correlation follows table 2 fields, not Verify orderId.
 * SIMULATOR_INTERNAL: local credential acceptance performs no authentication and
 * discards username/password after this boundary.
 */
export class BpVerifyRequestHandler {
  constructor(private readonly dependencies: BpVerifyRequestHandlerDependencies) {}

  execute(input: BpVerifyRequestInput): BpVerifyRequestResult {
    const transaction = this.dependencies.repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });
    if (transaction === undefined) {
      throw new BpVerifyRequestApplicationError(
        "VERIFY_CORRELATION_NOT_FOUND",
        "Verify correlation does not identify a completed local Sale.",
      );
    }

    if (transaction.reversalState === "REVERSED") {
      // PROTOCOL: page 21 explicitly includes previously reversed as a Verify
      // retry outcome; table 11 identifies its response code as 48.
      return { result: "48", transaction };
    }
    if (transaction.settlementState !== "NOT_REQUESTED") {
      throw new BpVerifyRequestApplicationError(
        "VERIFY_NOT_ELIGIBLE",
        "Verify is not eligible for this local transaction state.",
      );
    }
    if (transaction.verificationState === "VERIFIED") {
      return { result: "43", transaction };
    }
    if (transaction.saleState !== "SUCCEEDED") {
      throw new BpVerifyRequestApplicationError(
        "VERIFY_NOT_ELIGIBLE",
        "Verify is not eligible for this local transaction state.",
      );
    }

    // Both domain functions are immutable. Repository writes only final snapshot,
    // so a rejected request cannot persist a partial Verify attempt.
    const attempted = recordVerifyAttempted(transaction, this.dependencies.clock, this.dependencies.identifiers);
    const verified = recordVerificationConfirmed(attempted, this.dependencies.clock, this.dependencies.identifiers);
    return { result: "0", transaction: this.dependencies.repository.save(verified) };
  }
}
