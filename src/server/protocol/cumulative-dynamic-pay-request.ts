import type { Clock, IdentifierGenerator, Transaction, TransactionRepository } from "@/server/transactions";
import { TransactionDomainError, assignRefId, createTransaction } from "@/server/transactions";
import { formatSuccessfulPayResult, type RefIdGenerator } from "./pay-request";

/** PROTOCOL: one parsed table-10 `additionalData` distribution (printed page 30). */
export type CumulativeDynamicPayDistribution = Readonly<{
  accountId: string;
  amount: bigint;
  payerId: string;
}>;

/** PROTOCOL: v1.39 table 10, printed pages 30-31. */
export type BpCumulativeDynamicPayRequestInput = Readonly<{
  terminalId: bigint;
  userName: string;
  userPassword: string;
  orderId: bigint;
  amount: bigint;
  localDate: string;
  localTime: string;
  additionalData: string;
  distributions: readonly CumulativeDynamicPayDistribution[];
  callBackUrl: string;
  panHiddenMode?: string;
  cartItem?: string;
}>;

export type BpCumulativeDynamicPayRequestResult = Readonly<{ result: string; transaction?: Transaction }>;

export class BpCumulativeDynamicPayRequestApplicationError extends Error {
  constructor(
    readonly code: "DUPLICATE_CUMULATIVE_DYNAMIC_PAY_ORDER_ID" | "REF_ID_GENERATION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "BpCumulativeDynamicPayRequestApplicationError";
  }
}

/** SIMULATOR_INTERNAL: local Cumulative Dynamic Pay application boundary. */
export class BpCumulativeDynamicPayRequestHandler {
  constructor(private readonly dependencies: Readonly<{
    repository: TransactionRepository;
    clock: Clock;
    identifiers: IdentifierGenerator;
    refIds: RefIdGenerator;
  }>) {}

  execute(input: BpCumulativeDynamicPayRequestInput): BpCumulativeDynamicPayRequestResult {
    try {
      if (this.dependencies.repository.getByTerminalIdAndOrderId(input.terminalId, input.orderId) !== undefined) {
        throw new BpCumulativeDynamicPayRequestApplicationError(
          "DUPLICATE_CUMULATIVE_DYNAMIC_PAY_ORDER_ID",
          "Duplicate Cumulative Dynamic Pay orderId is not accepted by local simulator.",
        );
      }
      // Keep request creation atomic with local RefId allocation.
      const refId = this.nextUniqueRefId();
      const created = this.dependencies.repository.create(
        createTransaction(
          {
            paymentOperation: "CUMULATIVE_DYNAMIC_PAY",
            terminalId: input.terminalId,
            orderId: input.orderId,
            amount: input.amount,
            callBackUrl: input.callBackUrl,
          },
          this.dependencies.clock,
          this.dependencies.identifiers,
        ),
      );
      const transaction = this.dependencies.repository.save(
        assignRefId(created, refId, this.dependencies.clock, this.dependencies.identifiers),
      );
      return { result: formatSuccessfulPayResult(refId), transaction };
    } catch (error) {
      if (error instanceof TransactionDomainError && error.code === "DUPLICATE_PAY_ORDER_ID") {
        throw new BpCumulativeDynamicPayRequestApplicationError(
          "DUPLICATE_CUMULATIVE_DYNAMIC_PAY_ORDER_ID",
          "Duplicate Cumulative Dynamic Pay orderId is not accepted by local simulator.",
        );
      }
      throw error;
    }
  }

  private nextUniqueRefId(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const refId = this.dependencies.refIds.nextRefId();
      if (refId.length > 0 && this.dependencies.repository.getByRefId(refId) === undefined) return refId;
    }
    throw new BpCumulativeDynamicPayRequestApplicationError("REF_ID_GENERATION_FAILED", "Could not generate a unique local RefId.");
  }
}
