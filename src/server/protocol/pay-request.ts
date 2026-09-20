import { randomUUID } from "node:crypto";
import type { Clock, IdentifierGenerator, Transaction, TransactionRepository } from "@/server/transactions";
import { TransactionDomainError, assignRefId, createTransaction } from "@/server/transactions";

/** PROTOCOL: field names/types from v1.39 table 1 (printed page 15). */
export type BpPayRequestInput = Readonly<{
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
  mobileNo?: string;
  encPan?: string;
  panHiddenMode?: string;
  cartItem?: string;
  enc?: string;
}>;

/** SIMULATOR_INTERNAL: opaque local RefId generation boundary. */
export interface RefIdGenerator {
  nextRefId(): string;
}

export class RandomRefIdGenerator implements RefIdGenerator {
  nextRefId(): string {
    return `local_${randomUUID().replaceAll("-", "")}`;
  }
}

export type BpPayRequestResult = Readonly<{
  result: string;
  transaction?: Transaction;
}>;

export class BpPayRequestApplicationError extends Error {
  constructor(
    readonly code: "DUPLICATE_PAY_ORDER_ID" | "REF_ID_GENERATION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "BpPayRequestApplicationError";
  }
}

export type BpPayRequestHandlerDependencies = Readonly<{
  repository: TransactionRepository;
  clock: Clock;
  identifiers: IdentifierGenerator;
  refIds: RefIdGenerator;
}>;

/**
 * PROTOCOL: v1.39 says Pay orderId must be unique (printed pages 11 and 16).
 * UNSPECIFIED: v1.39 does not tie table-11 code 41 to this Pay condition.
 * SIMULATOR_INTERNAL: no merchant authentication is performed or persisted.
 */
export class BpPayRequestHandler {
  constructor(private readonly dependencies: BpPayRequestHandlerDependencies) {}

  execute(input: BpPayRequestInput): BpPayRequestResult {
    try {
      const created = this.dependencies.repository.create(
        createTransaction(
      {
            paymentOperation: "PAY",
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
        throw new BpPayRequestApplicationError(
          "DUPLICATE_PAY_ORDER_ID",
          "Duplicate Pay orderId is not accepted by local simulator.",
        );
      }
      throw error;
    }
  }

  private nextUniqueRefId(): string {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const refId = this.dependencies.refIds.nextRefId();
      if (refId.length > 0 && this.dependencies.repository.getByRefId(refId) === undefined) {
        return refId;
      }
    }

    throw new BpPayRequestApplicationError(
      "REF_ID_GENERATION_FAILED",
      "Could not generate a unique local RefId.",
    );
  }
}

/** PROTOCOL: successful Pay result example is `0,RefId` (v1.39 printed page 14). */
export function formatSuccessfulPayResult(refId: string): string {
  return `0,${refId}`;
}
