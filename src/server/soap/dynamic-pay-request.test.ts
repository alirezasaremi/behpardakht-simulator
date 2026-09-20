import { describe, expect, it } from "vitest";
import { extractBpDynamicPayRequest } from "./dynamic-pay-request";
import { SoapInputError } from "./errors";
import { parseLocalSoapOperation } from "./xml";

const fields = {
  terminalId: "9007199254740993", userName: "local-merchant", userPassword: "fake-test-password", orderId: "9007199254740995",
  amount: "1000", localDate: "20260101", localTime: "120000", additionalData: "safe test", callBackUrl: "https://merchant.test/callback", payerId: "0", subServiceId: "9007199254740997",
};

function operation(values: Record<string, string>) {
  return parseLocalSoapOperation(`<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpDynamicPayRequest>${Object.entries(values).map(([name, value]) => `<${name}>${value}</${name}>`).join("")}</bpDynamicPayRequest></soap:Body></soap:Envelope>`);
}

describe("extractBpDynamicPayRequest", () => {
  it("extracts table-9 normal-path fields with bigint precision and safe optional display fields", () => {
    expect(extractBpDynamicPayRequest(operation({ ...fields, panHiddenMode: "1", cartItem: "local item" }))).toEqual({
      terminalId: BigInt("9007199254740993"), userName: "local-merchant", userPassword: "fake-test-password", orderId: BigInt("9007199254740995"), amount: BigInt(1000), localDate: "20260101", localTime: "120000", additionalData: "safe test", callBackUrl: "https://merchant.test/callback", payerId: "0", subServiceId: BigInt("9007199254740997"), panHiddenMode: "1", cartItem: "local item",
    });
  });

  it("rejects missing/extra/non-decimal inputs and sensitive optional fields locally", () => {
    const withoutSubService = { terminalId: fields.terminalId, userName: fields.userName, userPassword: fields.userPassword, orderId: fields.orderId, amount: fields.amount, localDate: fields.localDate, localTime: fields.localTime, additionalData: fields.additionalData, callBackUrl: fields.callBackUrl, payerId: fields.payerId };
    for (const candidate of [
      operation(withoutSubService), operation({ ...fields, subServiceId: "1e3" }), operation({ ...fields, unknown: "x" }),
      operation({ ...fields, mobileNo: "989121231111" }), operation({ ...fields, encPan: "not-accepted" }), operation({ ...fields, enc: "not-accepted" }),
    ]) expect(() => extractBpDynamicPayRequest(candidate)).toThrow(SoapInputError);
  });
});
