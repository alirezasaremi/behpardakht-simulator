import { describe, expect, it } from "vitest";
import {
  ManualClock,
  InMemoryTransactionRepository,
  SequenceIdentifierGenerator,
  assignRefId,
  createTransaction,
  recordSaleSucceeded,
} from "@/server/transactions";
import { BpInquiryRequestHandler, type BpInquiryRequestInput } from "./inquiry-request";

function fixture() {
  const repository = new InMemoryTransactionRepository();
  const clock = new ManualClock(new Date("2026-01-01T00:00:00.000Z"));
  const identifiers = new SequenceIdentifierGenerator();
  const created = repository.create(assignRefId(createTransaction(
    { terminalId: BigInt("9007199254740993"), orderId: BigInt("9007199254740995"), amount: BigInt(1000), callBackUrl: "https://merchant.test/callback" },
    clock, identifiers,
  ), "LocalRef-Aa1", clock, identifiers));
  const sale = repository.save(recordSaleSucceeded(
    created,
    { refId: "LocalRef-Aa1", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999") },
    clock, identifiers,
  ));
  const input: BpInquiryRequestInput = {
    terminalId: BigInt("9007199254740993"), userName: "local-merchant", userPassword: "fake-test-password",
    orderId: BigInt("9007199254740995"), saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt("9007199254740999"),
  };
  return { repository, sale, handler: new BpInquiryRequestHandler({ repository }), input };
}

describe("BpInquiryRequestHandler", () => {
  it("does not turn Inquiry purpose into ATTEMPTED-only eligibility or invent result 0", () => {
    const { repository, sale, handler, input } = fixture();

    expect(() => handler.execute(input)).toThrow(expect.objectContaining({ code: "INQUIRY_RESULT_UNSPECIFIED" }));
    expect(repository.getById(sale.id)).toEqual(sale);
  });

  it("does not use Inquiry orderId for correlation and rejects mismatch without mutation", () => {
    const { repository, sale, handler, input } = fixture();

    expect(() => handler.execute({ ...input, orderId: BigInt("9007199254741995") })).toThrow(
      expect.objectContaining({ code: "INQUIRY_RESULT_UNSPECIFIED" }),
    );
    for (const mismatch of [{ ...input, terminalId: BigInt(1) }, { ...input, saleOrderId: BigInt(1) }, { ...input, saleReferenceId: BigInt(1) }]) {
      expect(() => handler.execute(mismatch)).toThrow(expect.objectContaining({ code: "INQUIRY_CORRELATION_NOT_FOUND" }));
    }
    expect(repository.getById(sale.id)).toEqual(sale);
  });
});
