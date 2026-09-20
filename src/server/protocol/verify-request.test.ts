import { describe, expect, it } from "vitest";
import {
  ManualClock,
  InMemoryTransactionRepository,
  SequenceIdentifierGenerator,
  assignRefId,
  createTransaction,
  recordSaleNonSuccess,
  recordSaleSucceeded,
  recordVerifyAttempted,
} from "@/server/transactions";
import { BpVerifyRequestHandler, type BpVerifyRequestInput } from "./verify-request";

const initialTime = new Date("2026-01-01T00:00:00.000Z");

function fixture() {
  const repository = new InMemoryTransactionRepository();
  const clock = new ManualClock(initialTime);
  const identifiers = new SequenceIdentifierGenerator();
  const original = repository.create(
    assignRefId(
      createTransaction(
        {
          terminalId: BigInt("9007199254740993"),
          orderId: BigInt("9007199254740995"),
          amount: BigInt("9007199254740997"),
          callBackUrl: "https://merchant.test/callback",
        },
        clock,
        identifiers,
      ),
      "LocalRef-Aa1",
      clock,
      identifiers,
    ),
  );
  const sold = repository.save(
    recordSaleSucceeded(
      original,
      {
        refId: "LocalRef-Aa1",
        saleOrderId: BigInt("9007199254740995"),
        saleReferenceId: BigInt("9007199254740999"),
      },
      clock,
      identifiers,
    ),
  );
  const handler = new BpVerifyRequestHandler({ repository, clock, identifiers });
  const input: BpVerifyRequestInput = {
    terminalId: BigInt("9007199254740993"),
    userName: "local-merchant",
    userPassword: "fake-test-password",
    orderId: BigInt("9007199254740995"),
    saleOrderId: BigInt("9007199254740995"),
    saleReferenceId: BigInt("9007199254740999"),
  };
  return { repository, clock, identifiers, sold, handler, input };
}

describe("BpVerifyRequestHandler", () => {
  it("confirms successful Sale without settling and preserves bigint correlations", () => {
    const { repository, clock, handler, input } = fixture();
    clock.advanceBy(1_000);

    const result = handler.execute(input);
    const stored = repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });

    expect(result.result).toBe("0"); // PROTOCOL: v1.39 printed page 21 says Verify returns response code; table 11 code 0 is success.
    expect(stored).toMatchObject({
      saleState: "SUCCEEDED",
      verificationState: "VERIFIED",
      settlementState: "NOT_REQUESTED",
      saleOrderId: BigInt("9007199254740995"),
      saleReferenceId: BigInt("9007199254740999"),
      verifiedAt: "2026-01-01T00:00:01.000Z",
    });
    expect(stored?.events.map((event) => event.type)).toEqual([
      "TRANSACTION_CREATED",
      "REF_ID_ASSIGNED",
      "SALE_SUCCEEDED",
      "VERIFY_ATTEMPTED",
      "VERIFICATION_CONFIRMED",
    ]);
    expect(stored?.events.slice(-2).every((event) => event.at === "2026-01-01T00:00:01.000Z")).toBe(true);
    expect("userPassword" in (stored ?? {})).toBe(false);
    expect(stored?.events.every((event) => !("userPassword" in event))).toBe(true);
  });

  it("returns documented already-verified code without adding an event", () => {
    const { repository, handler, input } = fixture();
    handler.execute(input);
    const before = repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });

    const repeated = handler.execute(input);
    const after = repository.getByProtocolCorrelation({
      terminalId: input.terminalId,
      saleOrderId: input.saleOrderId,
      saleReferenceId: input.saleReferenceId,
    });

    // PROTOCOL: table 11 code 43 says a prior Verify succeeded.
    expect(repeated.result).toBe("43");
    expect(after).toEqual(before);
  });

  it("does not use Verify orderId for Sale lookup or enforce Pay uniqueness", () => {
    const { repository, clock, identifiers, handler, input } = fixture();
    const secondOriginal = repository.create(
      assignRefId(
        createTransaction(
          {
            terminalId: input.terminalId,
            orderId: BigInt("9007199254741995"),
            amount: BigInt(1_000),
            callBackUrl: "https://merchant.test/second",
          },
          clock,
          identifiers,
        ),
        "LocalRef-Aa2",
        clock,
        identifiers,
      ),
    );
    repository.save(
      recordSaleSucceeded(
        secondOriginal,
        { refId: "LocalRef-Aa2", saleOrderId: BigInt("9007199254741995"), saleReferenceId: BigInt("9007199254742999") },
        clock,
        identifiers,
      ),
    );

    expect(handler.execute(input).result).toBe("0");
    expect(
      handler.execute({
        ...input,
        // Same non-unique Verify number; it may also equal first saleOrderId.
        saleOrderId: BigInt("9007199254741995"),
        saleReferenceId: BigInt("9007199254742999"),
      }).result,
    ).toBe("0");
  });

  it("does not save partial mutation for bad correlation or non-success Sale", () => {
    const { repository, clock, identifiers, handler, input, sold } = fixture();
    const before = repository.getById(sold.id);

    expect(() => handler.execute({ ...input, saleReferenceId: BigInt(1) })).toThrow(
      expect.objectContaining({ code: "VERIFY_CORRELATION_NOT_FOUND" }),
    );
    expect(repository.getById(sold.id)).toEqual(before);

    const nonSuccess = repository.save(
      recordSaleNonSuccess(
        repository.create(
          assignRefId(
            createTransaction(
              { terminalId: BigInt(1), orderId: BigInt(2), amount: BigInt(3), callBackUrl: "https://merchant.test/non-success" },
              clock,
              identifiers,
            ),
            "LocalRef-NonSuccess",
            clock,
            identifiers,
          ),
        ),
        { refId: "LocalRef-NonSuccess", resCode: "17", saleOrderId: BigInt(2), saleReferenceId: BigInt(3) },
        clock,
        identifiers,
      ),
    );
    expect(recordVerifyAttempted(nonSuccess, clock, identifiers).verificationState).toBe("ATTEMPTED");
    expect(() =>
      handler.execute({ ...input, terminalId: BigInt(1), saleOrderId: BigInt(2), saleReferenceId: BigInt(3) }),
    ).toThrow(expect.objectContaining({ code: "VERIFY_NOT_ELIGIBLE" }));
    expect(repository.getById(nonSuccess.id)).toEqual(nonSuccess);
  });
});
