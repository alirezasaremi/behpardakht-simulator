import type { Clock, IdentifierGenerator, Transaction, TransactionRepository } from "@/server/transactions";
import { TransactionDomainError, assignRefId, createTransaction } from "@/server/transactions";
import { formatSuccessfulPayResult, type RefIdGenerator } from "./pay-request";

/** PROTOCOL: v1.39 table 9, printed pages 28-29. */
export type BpDynamicPayRequestInput = Readonly<{
  terminalId: bigint;
  userName: string;
  userPassword: string;
  orderId: bigint;
  amount: bigint;
  localDate: string;
  localTime: string;
  additionalData: string;
  callBackUrl: string;
  payerId: string;
  subServiceId: bigint;
  panHiddenMode?: string;
  cartItem?: string;
}>;

export type BpDynamicPayRequestResult = Readonly<{ result: string; transaction?: Transaction }>;

export class BpDynamicPayRequestApplicationError extends Error {
  constructor(
    readonly code: "DUPLICATE_DYNAMIC_PAY_ORDER_ID" | "REF_ID_GENERATION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "BpDynamicPayRequestApplicationError";
  }
}

/** SIMULATOR_INTERNAL: local Dynamic Pay application boundary. */
export class BpDynamicPayRequestHandler {
  constructor(private readonly dependencies: Readonly<{
    repository: TransactionRepository;
    clock: Clock;
    identifiers: IdentifierGenerator;
    refIds: RefIdGenerator;
  }>) {}

  execute(input: BpDynamicPayRequestInput): BpDynamicPayRequestResult {
    try {
      const created = this.dependencies.repository.create(
        createTransaction(
          {
            paymentOperation: "DYNAMIC_PAY",
            terminalId: input.terminalId,
            orderId: input.orderId,
            amount: input.amount,
            callBackUrl: input.callBackUrl,
          },
          this.dependencies.clock,
          this.dependencies.identifiers,
        ),
      );
      const refId = this.nextUniqueRefId();
      const transaction = this.dependencies.repository.save(
        assignRefId(created, refId, this.dependencies.clock, this.dependencies.identifiers),
      );
      return { result: formatSuccessfulPayResult(refId), transaction };
    } catch (error) {
      if (error instanceof TransactionDomainError && error.code === "DUPLICATE_PAY_ORDER_ID") {
        throw new BpDynamicPayRequestApplicationError(
          "DUPLICATE_DYNAMIC_PAY_ORDER_ID",
          "Duplicate Dynamic Pay orderId is not accepted by local simulator.",
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
    throw new BpDynamicPayRequestApplicationError("REF_ID_GENERATION_FAILED", "Could not generate a unique local RefId.");
  }
}
