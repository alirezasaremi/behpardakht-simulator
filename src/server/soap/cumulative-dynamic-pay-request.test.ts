import { describe, expect, it } from "vitest";
import { extractBpCumulativeDynamicPayRequest } from "./cumulative-dynamic-pay-request";
import { SoapInputError } from "./errors";
import { parseLocalSoapOperation } from "./xml";

const fields = {
  terminalId: "9007199254740993", userName: "local-merchant", userPassword: "fake-test-password", orderId: "9007199254740995",
  amount: "900719925474099912345", localDate: "20260101", localTime: "120000",
  additionalData: "account-one,900719925474099900000,payer-one;account-two,12345,;", callBackUrl: "https://merchant.test/callback",
};

function operation(values: Record<string, string>) {
  return parseLocalSoapOperation(`<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpCumulativeDynamicPayRequest>${Object.entries(values).map(([name, value]) => `<${name}>${value}</${name}>`).join("")}</bpCumulativeDynamicPayRequest></soap:Body></soap:Envelope>`);
}

describe("extractBpCumulativeDynamicPayRequest", () => {
  it("parses table-10 delimiters, preserves bigint precision, permits illustrated empty payerId, and validates total", () => {
    const input = extractBpCumulativeDynamicPayRequest(operation(fields));
    expect(input.amount).toBe(BigInt("900719925474099912345"));
    expect(input.distributions).toEqual([
      { accountId: "account-one", amount: BigInt("900719925474099900000"), payerId: "payer-one" },
      { accountId: "account-two", amount: BigInt(12345), payerId: "" },
    ]);
  });

  it("rejects invalid local grammar, mismatched totals, excess entries, and sensitive fields without partial mutation", () => {
    const excess = Array.from({ length: 11 }, (_, index) => `account-${index},1,`).join(";");
    for (const candidate of [
      operation({ ...fields, additionalData: "account,1" }),
      operation({ ...fields, additionalData: "account,1,payer;;other,1,payer", amount: "2" }),
      operation({ ...fields, additionalData: "account,1,payer", amount: "2" }),
      operation({ ...fields, additionalData: excess, amount: "11" }),
      operation({ ...fields, mobileNo: "989121231111" }),
      operation({ ...fields, encPan: "not-accepted" }),
      operation({ ...fields, enc: "not-accepted" }),
    ]) expect(() => extractBpCumulativeDynamicPayRequest(candidate)).toThrow(SoapInputError);
  });
});
