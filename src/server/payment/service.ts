import type { CallbackDispatcher } from "@/server/callbacks";
import {
  recordCallbackDispatchAttempted,
  recordCallbackDispatchFailed,
  recordCallbackDispatchSucceeded,
  recordSaleNonSuccess,
  recordSaleSucceeded,
  type Clock,
  type IdentifierGenerator,
  type Transaction,
  type TransactionRepository,
} from "@/server/transactions";

export type PaymentOutcome = "SUCCESS" | "NON_SUCCESS";

export interface SaleReferenceIdGenerator {
  nextSaleReferenceId(): bigint;
}

export class PaymentApplicationError extends Error {
  constructor(readonly code: "UNKNOWN_REF_ID" | "SALE_REFERENCE_ID_GENERATION_FAILED", message: string) {
    super(message);
    this.name = "PaymentApplicationError";
  }
}

export type LocalPaymentServiceDependencies = Readonly<{
  repository: TransactionRepository;
  clock: Clock;
  identifiers: IdentifierGenerator;
  saleReferenceIds: SaleReferenceIdGenerator;
  callbacks: CallbackDispatcher;
}>;

/** SIMULATOR_INTERNAL orchestration of local payment-page actions. */
export class LocalPaymentService {
  constructor(private readonly dependencies: LocalPaymentServiceDependencies) {}

  findByRefId(refId: string): Transaction {
    const transaction = this.dependencies.repository.getByRefId(refId);
    if (transaction === undefined) {
      throw new PaymentApplicationError("UNKNOWN_REF_ID", "No local Pay transaction exists for this RefId.");
    }
    return transaction;
  }

  async complete(refId: string, outcome: PaymentOutcome): Promise<Transaction> {
    const current = this.findByRefId(refId);
    const saleReferenceId = this.nextUniqueSaleReferenceId();
    const sold =
      outcome === "SUCCESS"
        ? recordSaleSucceeded(
            current,
            { refId, saleOrderId: current.orderId, saleReferenceId },
            this.dependencies.clock,
            this.dependencies.identifiers,
          )
        : recordSaleNonSuccess(
            current,
            {
              refId,
              // PROTOCOL: table 11 code 17 is cardholder cancellation.
              // SIMULATOR_SCENARIO: this is Goal 4's single exposed non-success choice.
              resCode: "17",
              saleOrderId: current.orderId,
              saleReferenceId,
            },
            this.dependencies.clock,
            this.dependencies.identifiers,
          );
    const attempted = this.dependencies.repository.save(
      recordCallbackDispatchAttempted(sold, this.dependencies.clock, this.dependencies.identifiers),
    );
    const dispatch = await this.dependencies.callbacks.dispatch(attempted);
    const completed =
      dispatch.kind === "SUCCEEDED"
        ? recordCallbackDispatchSucceeded(attempted, dispatch.httpStatus, this.dependencies.clock, this.dependencies.identifiers)
        : recordCallbackDispatchFailed(
            attempted,
            dispatch.reason,
            dispatch.httpStatus,
            this.dependencies.clock,
            this.dependencies.identifiers,
          );
    return this.dependencies.repository.save(completed);
  }

  private nextUniqueSaleReferenceId(): bigint {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = this.dependencies.saleReferenceIds.nextSaleReferenceId();
      if (candidate >= BigInt(0) && this.dependencies.repository.getBySaleReferenceId(candidate) === undefined) {
        return candidate;
      }
    }
    throw new PaymentApplicationError(
      "SALE_REFERENCE_ID_GENERATION_FAILED",
      "Could not generate a unique local SaleReferenceId.",
    );
  }
}
