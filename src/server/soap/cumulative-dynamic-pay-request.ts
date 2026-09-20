import type { BpCumulativeDynamicPayRequestInput, CumulativeDynamicPayDistribution } from "@/server/protocol";
import { SoapInputError } from "./errors";
import type { ParsedSoapOperation } from "./xml";

const REQUIRED_FIELD_NAMES = ["terminalId", "userName", "userPassword", "orderId", "amount", "localDate", "localTime", "additionalData", "callBackUrl"] as const;
const SAFE_OPTIONAL_FIELD_NAMES = ["panHiddenMode", "cartItem"] as const;
const SENSITIVE_OPTIONAL_FIELD_NAMES = new Set(["mobileNo", "encPan", "enc"]);
const ALLOWED_FIELD_NAMES = new Set<string>([...REQUIRED_FIELD_NAMES, ...SAFE_OPTIONAL_FIELD_NAMES, ...SENSITIVE_OPTIONAL_FIELD_NAMES]);
const MAX_LOCAL_STRING_CHARACTERS = 4_096;
const MAX_CALLBACK_URL_CHARACTERS = 2_048;
const MAX_DISTRIBUTIONS = 10;

/** PROTOCOL table 10 fields; SIMULATOR_INTERNAL bounded normal-path parser. */
export function extractBpCumulativeDynamicPayRequest(operation: ParsedSoapOperation): BpCumulativeDynamicPayRequestInput {
  if (operation.name !== "bpCumulativeDynamicPayRequest") {
    throw new SoapInputError("UNSUPPORTED_OPERATION", "Only bpCumulativeDynamicPayRequest is supported.");
  }
  for (const name of operation.fields.keys()) {
    if (!ALLOWED_FIELD_NAMES.has(name) || SENSITIVE_OPTIONAL_FIELD_NAMES.has(name)) {
      throw new SoapInputError("INVALID_CUMULATIVE_DYNAMIC_PAY_REQUEST", "bpCumulativeDynamicPayRequest contains an unsupported field.");
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
  assertMaximumLength("userName", userName, MAX_LOCAL_STRING_CHARACTERS);
  assertMaximumLength("userPassword", userPassword, MAX_LOCAL_STRING_CHARACTERS);
  assertMaximumLength("callBackUrl", callBackUrl, MAX_CALLBACK_URL_CHARACTERS);
  assertMaximumLength("additionalData", additionalData, MAX_LOCAL_STRING_CHARACTERS);
  if (!/^\d{8}$/.test(localDate) || !/^\d{6}$/.test(localTime)) {
    throw new SoapInputError("INVALID_CUMULATIVE_DYNAMIC_PAY_REQUEST", "bpCumulativeDynamicPayRequest date or time is invalid.");
  }
  const parsedAmount = decimalBigInt("amount", amount);
  const distributions = parseDistributions(additionalData);
  if (distributions.reduce((total, distribution) => total + distribution.amount, BigInt(0)) !== parsedAmount) {
    throw new SoapInputError("INVALID_CUMULATIVE_DYNAMIC_PAY_REQUEST", "Cumulative distribution total must equal amount.");
  }
  return {
    terminalId: decimalBigInt("terminalId", terminalId), userName, userPassword, orderId: decimalBigInt("orderId", orderId),
    amount: parsedAmount, localDate, localTime, additionalData, distributions, callBackUrl,
    panHiddenMode: optional(operation, "panHiddenMode"), cartItem: optional(operation, "cartItem"),
  };
}

/** Table 10 supplies delimiters and entry maximum; lexical profile is local-only. */
function parseDistributions(value: string): readonly CumulativeDynamicPayDistribution[] {
  const withoutTerminalDelimiter = value.endsWith(";") ? value.slice(0, -1) : value;
  if (withoutTerminalDelimiter.length === 0 || withoutTerminalDelimiter.includes(";;")) {
    throw new SoapInputError("INVALID_CUMULATIVE_DYNAMIC_PAY_REQUEST", "Cumulative additionalData has invalid distribution delimiters.");
  }
  const entries = withoutTerminalDelimiter.split(";");
  if (entries.length > MAX_DISTRIBUTIONS) {
    throw new SoapInputError("INVALID_CUMULATIVE_DYNAMIC_PAY_REQUEST", "Cumulative additionalData exceeds ten distributions.");
  }
  return Object.freeze(entries.map((entry) => {
    const fields = entry.split(",");
    if (fields.length !== 3 || fields[0].length === 0 || !/^\d+$/.test(fields[1])) {
      throw new SoapInputError("INVALID_CUMULATIVE_DYNAMIC_PAY_REQUEST", "Cumulative additionalData has invalid distribution fields.");
    }
    return Object.freeze({ accountId: fields[0], amount: BigInt(fields[1]), payerId: fields[2] });
  }));
}

function required(operation: ParsedSoapOperation, name: (typeof REQUIRED_FIELD_NAMES)[number]): string {
  const value = operation.fields.get(name);
  if (value === undefined) throw new SoapInputError("INVALID_CUMULATIVE_DYNAMIC_PAY_REQUEST", "bpCumulativeDynamicPayRequest is missing a required field.");
  return value;
}
function optional(operation: ParsedSoapOperation, name: (typeof SAFE_OPTIONAL_FIELD_NAMES)[number]): string | undefined {
  const value = operation.fields.get(name);
  if (value !== undefined) assertMaximumLength(name, value, MAX_LOCAL_STRING_CHARACTERS);
  return value;
}
function decimalBigInt(name: string, value: string): bigint {
  if (!/^\d+$/.test(value)) throw new SoapInputError("INVALID_CUMULATIVE_DYNAMIC_PAY_REQUEST", `${name} must be a decimal integer.`);
  return BigInt(value);
}
function assertMaximumLength(name: string, value: string, maximum: number): void {
  if (Array.from(value).length > maximum) throw new SoapInputError("INVALID_CUMULATIVE_DYNAMIC_PAY_REQUEST", `${name} exceeds a permitted size.`);
}
