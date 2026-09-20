import type { BpDynamicPayRequestInput } from "@/server/protocol";
import { SoapInputError } from "./errors";
import type { ParsedSoapOperation } from "./xml";

const REQUIRED_FIELD_NAMES = ["terminalId", "userName", "userPassword", "orderId", "amount", "localDate", "localTime", "additionalData", "callBackUrl", "payerId", "subServiceId"] as const;
const SAFE_OPTIONAL_FIELD_NAMES = ["panHiddenMode", "cartItem"] as const;
const SENSITIVE_OPTIONAL_FIELD_NAMES = new Set(["mobileNo", "encPan", "enc"]);
const ALLOWED_FIELD_NAMES = new Set<string>([...REQUIRED_FIELD_NAMES, ...SAFE_OPTIONAL_FIELD_NAMES, ...SENSITIVE_OPTIONAL_FIELD_NAMES]);
const MAX_LOCAL_STRING_CHARACTERS = 4_096;
const MAX_CALLBACK_URL_CHARACTERS = 2_048;

/** PROTOCOL table 9 fields; SIMULATOR_INTERNAL safe local validation profile. */
export function extractBpDynamicPayRequest(operation: ParsedSoapOperation): BpDynamicPayRequestInput {
  if (operation.name !== "bpDynamicPayRequest") throw new SoapInputError("UNSUPPORTED_OPERATION", "Only bpDynamicPayRequest is supported.");
  for (const name of operation.fields.keys()) {
    if (!ALLOWED_FIELD_NAMES.has(name) || SENSITIVE_OPTIONAL_FIELD_NAMES.has(name)) {
      throw new SoapInputError("INVALID_PAY_REQUEST", "bpDynamicPayRequest contains an unsupported field.");
    }
  }

  const terminalId = required(operation, "terminalId");
  const userName = required(operation, "userName");
  const userPassword = required(operation, "userPassword");
  const orderId = required(operation, "orderId");
  const amount = required(operation, "amount");
  const localDate = required(operation, "localDate");
  const localTime = required(operation, "localTime");
  const additionalData = required(operation, "additionalData");
  const callBackUrl = required(operation, "callBackUrl");
  const payerId = required(operation, "payerId");
  const subServiceId = required(operation, "subServiceId");
  assertMaximumLength("userName", userName, MAX_LOCAL_STRING_CHARACTERS);
  assertMaximumLength("userPassword", userPassword, MAX_LOCAL_STRING_CHARACTERS);
  assertMaximumLength("callBackUrl", callBackUrl, MAX_CALLBACK_URL_CHARACTERS);
  assertMaximumLength("payerId", payerId, MAX_LOCAL_STRING_CHARACTERS);
  assertMaximumLength("additionalData", additionalData, 1_000);
  if (!/^\d{8}$/.test(localDate) || !/^\d{6}$/.test(localTime)) {
    throw new SoapInputError("INVALID_PAY_REQUEST", "bpDynamicPayRequest date or time is invalid.");
  }
  return {
    terminalId: decimalBigInt("terminalId", terminalId), userName, userPassword, orderId: decimalBigInt("orderId", orderId),
    amount: decimalBigInt("amount", amount), localDate, localTime, additionalData, callBackUrl, payerId,
    subServiceId: decimalBigInt("subServiceId", subServiceId), panHiddenMode: optional(operation, "panHiddenMode"), cartItem: optional(operation, "cartItem"),
  };
}

function required(operation: ParsedSoapOperation, name: (typeof REQUIRED_FIELD_NAMES)[number]): string {
  const value = operation.fields.get(name);
  if (value === undefined) throw new SoapInputError("INVALID_PAY_REQUEST", "bpDynamicPayRequest is missing a required field.");
  return value;
}
function optional(operation: ParsedSoapOperation, name: (typeof SAFE_OPTIONAL_FIELD_NAMES)[number]): string | undefined {
  const value = operation.fields.get(name);
  if (value !== undefined) assertMaximumLength(name, value, MAX_LOCAL_STRING_CHARACTERS);
  return value;
}
function decimalBigInt(name: string, value: string): bigint {
  if (!/^\d+$/.test(value)) throw new SoapInputError("INVALID_PAY_REQUEST", `${name} must be a decimal integer.`);
  return BigInt(value);
}
function assertMaximumLength(name: string, value: string, maximum: number): void {
  if (Array.from(value).length > maximum) throw new SoapInputError("INVALID_PAY_REQUEST", `${name} exceeds a permitted size.`);
}
