import type { TransactionRepository } from "@/server/transactions";

/** PROTOCOL: v1.39 printed page 23, table 4 names and types. */
export type BpInquiryRequestInput = Readonly<{
  terminalId: bigint;
  userName: string;
  userPassword: string;
  /** Inquiry-request number. It need not be unique and may equal saleOrderId. */
  orderId: bigint;
  /** Purchase-request number: original Pay orderId. */
  saleOrderId: bigint;
  /** Purchase transaction reference used in Verify. */
  saleReferenceId: bigint;
}>;

export type BpInquiryRequestHandlerDependencies = Readonly<{ repository: TransactionRepository }>;

export class BpInquiryRequestApplicationError extends Error {
  constructor(
    readonly code: "INQUIRY_CORRELATION_NOT_FOUND" | "INQUIRY_RESULT_UNSPECIFIED",
    message: string,
  ) {
    super(message);
    this.name = "BpInquiryRequestApplicationError";
  }
}

/**
 * PROTOCOL: pages 10 and 23 define Inquiry's purpose and table-4 fields.
 * Page 23 names a response-code string but supplies no operation-specific
 * response-code mapping.
 *
 * SIMULATOR_INTERNAL: local SOAP faults preserve source fidelity until a
 * source-backed Inquiry response mapping exists. Purpose is not an eligibility
 * rule, so handler does not require internal ATTEMPTED state.
 */
export class BpInquiryRequestHandler {
  constructor(private readonly dependencies: BpInquiryRequestHandlerDependencies) {}

  execute(input: BpInquiryRequestInput): never {
    const transaction = this.dependencies.repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });
    if (transaction === undefined) {
      throw new BpInquiryRequestApplicationError(
        "INQUIRY_CORRELATION_NOT_FOUND",
        "Inquiry correlation does not identify a completed local Sale.",
      );
    }
    throw new BpInquiryRequestApplicationError(
      "INQUIRY_RESULT_UNSPECIFIED",
      "v1.39 does not map this Inquiry state to a provider response code.",
    );
  }
}
