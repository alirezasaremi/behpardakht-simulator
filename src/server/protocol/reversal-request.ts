import type { TransactionRepository } from "@/server/transactions";

/** PROTOCOL: v1.39 printed pages 23-24, table 5 names and types. */
export type BpReversalRequestInput = Readonly<{
  terminalId: bigint;
  userName: string;
  userPassword: string;
  /** Reversal-request number. It need not be unique and may equal saleOrderId. */
  orderId: bigint;
  /** Purchase-request number: original Pay orderId. */
  saleOrderId: bigint;
  /** Purchase transaction reference used in Verify. */
  saleReferenceId: bigint;
}>;

export type BpReversalRequestHandlerDependencies = Readonly<{ repository: TransactionRepository }>;

export class BpReversalRequestApplicationError extends Error {
  constructor(
    readonly code:
      | "REVERSAL_CORRELATION_NOT_FOUND"
      | "REVERSAL_PREREQUISITE_NOT_MET"
      | "REVERSAL_SETTLEMENT_REQUESTED"
      | "REVERSAL_RESULT_UNSPECIFIED",
    message: string,
  ) {
    super(message);
    this.name = "BpReversalRequestApplicationError";
  }
}

/**
 * PROTOCOL: pages 10 and 23-24 place Reversal after Verify, state no-settlement
 * condition for end-of-day reversal, and identify table-5 correlation fields.
 * They name response-code string but no operation-specific response-code map.
 *
 * SIMULATOR_INTERNAL: no provider success/result is modeled until source maps
 * one. Internal ATTEMPTED versus VERIFIED is not provider eligibility rule.
 */
export class BpReversalRequestHandler {
  constructor(private readonly dependencies: BpReversalRequestHandlerDependencies) {}

  execute(input: BpReversalRequestInput): never {
    const transaction = this.dependencies.repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });
    if (transaction === undefined) {
      throw new BpReversalRequestApplicationError(
        "REVERSAL_CORRELATION_NOT_FOUND",
        "Reversal correlation does not identify a completed local Sale.",
      );
    }
    if (transaction.verificationState === "NOT_ATTEMPTED") {
      throw new BpReversalRequestApplicationError(
        "REVERSAL_PREREQUISITE_NOT_MET",
        "Reversal follows a local Verify invocation.",
      );
    }
    if (transaction.settlementState !== "NOT_REQUESTED") {
      throw new BpReversalRequestApplicationError(
        "REVERSAL_SETTLEMENT_REQUESTED",
        "Reversal is unavailable after a local settlement request.",
      );
    }
    throw new BpReversalRequestApplicationError(
      "REVERSAL_RESULT_UNSPECIFIED",
      "v1.39 does not map this Reversal state to a provider response code.",
    );
  }
}
