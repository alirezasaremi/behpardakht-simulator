import type { Transaction } from "@/server/transactions";

export type CallbackPayload = Readonly<{
  RefId: string;
  ResCode: string;
  SaleOrderId: string;
  SaleReferenceId: string;
  CardHolderPan: string;
  CreditCardSaleResponseDetail: string;
  FinalAmount: string;
}>;

/**
 * PROTOCOL: names, casing, and source types are v1.39 table 13 (printed page 33).
 * SIMULATOR_INTERNAL: success FinalAmount equals Pay amount; non-success is zero.
 */
export function buildCallbackPayload(transaction: Transaction): CallbackPayload {
  if (
    transaction.refId === undefined ||
    transaction.saleOrderId === undefined ||
    transaction.saleReferenceId === undefined ||
    transaction.saleResCode === undefined
  ) {
    throw new Error("Completed Sale is missing callback correlation values.");
  }

  return {
    RefId: transaction.refId,
    ResCode: transaction.saleResCode,
    SaleOrderId: transaction.saleOrderId.toString(),
    SaleReferenceId: transaction.saleReferenceId.toString(),
    // SIMULATOR_INTERNAL: intentionally invalid, masked test value; never collected or derived from a real PAN.
    CardHolderPan: "000000*****0000",
    // PROTOCOL: relevant to credit Iranian-goods purchases. SIMULATOR_INTERNAL: blank for this non-credit simulator flow.
    CreditCardSaleResponseDetail: "",
    FinalAmount: transaction.saleState === "SUCCEEDED" ? transaction.amount.toString() : "0",
  };
}

/** SIMULATOR_INTERNAL safe display only; drops credentials, query, and fragment. */
export function displayCallbackDestination(value: string): string {
  try {
    const url = new URL(value);
    if (url.username.length > 0 || url.password.length > 0) {
      return "Invalid stored callback URL";
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return "Invalid stored callback URL";
  }
}
