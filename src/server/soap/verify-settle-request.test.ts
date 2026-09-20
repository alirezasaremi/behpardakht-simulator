import { describe, expect, it } from "vitest";
import { SoapInputError } from "./errors";
import { extractBpVerifySettleRequest } from "./verify-settle-request";
import { parseLocalSoapOperation } from "./xml";

function operation(fields: Record<string, string>) {
  return parseLocalSoapOperation(`<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpVerifySettleRequest>${Object.entries(fields)
    .map(([name, value]) => `<${name}>${value}</${name}>`)
    .join("")}</bpVerifySettleRequest></soap:Body></soap:Envelope>`);
}

const fields = {
  terminalId: "9007199254740993",
  userName: "local-merchant",
  userPassword: "fake-test-password",
  orderId: "9007199254740995",
  saleOrderId: "9007199254740995",
  saleReferenceId: "9007199254740999",
};

describe("extractBpVerifySettleRequest", () => {
  it("extracts exact table-12 fields with bigint precision", () => {
    const extracted = extractBpVerifySettleRequest(operation(fields));

    // PROTOCOL: v1.39 printed pages 31-32 table 12 specifies these six fields as long/string values.
    expect(extracted).toEqual({
      terminalId: BigInt("9007199254740993"),
      userName: "local-merchant",
      userPassword: "fake-test-password",
      orderId: BigInt("9007199254740995"),
      saleOrderId: BigInt("9007199254740995"),
      saleReferenceId: BigInt("9007199254740999"),
    });
  });

  it("rejects wrong operation, malformed long, missing, and extra fields locally", () => {
    expect(() => extractBpVerifySettleRequest({ name: "bpSettleRequest", fields: new Map() })).toThrow(
      expect.objectContaining({ code: "UNSUPPORTED_OPERATION" }),
    );
    expect(() => extractBpVerifySettleRequest(operation({ ...fields, saleReferenceId: "1e3" }))).toThrow(
      expect.objectContaining({ code: "INVALID_VERIFY_SETTLE_REQUEST" }),
    );
    const withoutPassword = {
      terminalId: fields.terminalId,
      userName: fields.userName,
      orderId: fields.orderId,
      saleOrderId: fields.saleOrderId,
      saleReferenceId: fields.saleReferenceId,
    };
    expect(() => extractBpVerifySettleRequest(operation(withoutPassword))).toThrow(SoapInputError);
    expect(() => extractBpVerifySettleRequest(operation({ ...fields, unexpected: "x" }))).toThrow(SoapInputError);
  });
});
