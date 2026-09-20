import type { BpSettleRequestInput } from "@/server/protocol";
import { SoapInputError } from "./errors";
import type { ParsedSoapOperation } from "./xml";

const REQUIRED_FIELD_NAMES = [
  "terminalId",
  "userName",
  "userPassword",
  "orderId",
  "saleOrderId",
  "saleReferenceId",
] as const;
const ALLOWED_FIELD_NAMES = new Set<string>(REQUIRED_FIELD_NAMES);
const MAX_LOCAL_STRING_CHARACTERS = 4_096;

/** PROTOCOL: v1.39 printed page 22 table 3 fields; local structural checks are SIMULATOR_INTERNAL. */
export function extractBpSettleRequest(operation: ParsedSoapOperation): BpSettleRequestInput {
  if (operation.name !== "bpSettleRequest") {
    throw new SoapInputError("UNSUPPORTED_OPERATION", "Only supported SOAP operations are accepted.");
  }
  for (const name of operation.fields.keys()) {
    if (!ALLOWED_FIELD_NAMES.has(name)) {
      throw new SoapInputError("INVALID_SETTLE_REQUEST", "bpSettleRequest contains an unsupported field.");
    }
  }

  const terminalId = required(operation, "terminalId");
  const userName = required(operation, "userName");
  const userPassword = required(operation, "userPassword");
  const orderId = required(operation, "orderId");
  const saleOrderId = required(operation, "saleOrderId");
  const saleReferenceId = required(operation, "saleReferenceId");

  assertMaximumLength("userName", userName);
  assertMaximumLength("userPassword", userPassword);

  return {
    terminalId: decimalBigInt("terminalId", terminalId),
    userName,
    userPassword,
    orderId: decimalBigInt("orderId", orderId),
    saleOrderId: decimalBigInt("saleOrderId", saleOrderId),
    saleReferenceId: decimalBigInt("saleReferenceId", saleReferenceId),
  };
}

function required(operation: ParsedSoapOperation, name: (typeof REQUIRED_FIELD_NAMES)[number]): string {
  const value = operation.fields.get(name);
  if (value === undefined) {
    throw new SoapInputError("INVALID_SETTLE_REQUEST", "bpSettleRequest is missing a required field.");
  }
  return value;
}

function decimalBigInt(name: string, value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new SoapInputError("INVALID_SETTLE_REQUEST", `${name} must be a decimal integer.`);
  }
  return BigInt(value);
}

function assertMaximumLength(name: string, value: string): void {
  if (Array.from(value).length > MAX_LOCAL_STRING_CHARACTERS) {
    throw new SoapInputError("INVALID_SETTLE_REQUEST", `${name} exceeds a permitted size.`);
  }
}
