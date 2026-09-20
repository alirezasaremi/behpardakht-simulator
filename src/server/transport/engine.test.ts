import { describe, expect, it } from "vitest";
import {
  InMemoryTransactionRepository,
  ManualClock,
  SequenceIdentifierGenerator,
  assignRefId,
  createTransaction,
} from "@/server/transactions";
import { TransportFaultEngine } from "./engine";

function fixture() {
  const repository = new InMemoryTransactionRepository();
  const clock = new ManualClock(new Date("2026-01-01T00:00:00.000Z"));
  const identifiers = new SequenceIdentifierGenerator();
  const first = repository.create(assignRefId(
    createTransaction(
      { terminalId: BigInt(10), orderId: BigInt(20), amount: BigInt(100), callBackUrl: "https://merchant.test/callback" },
      clock,
      identifiers,
    ),
    "local-first",
    clock,
    identifiers,
  ));
  const second = repository.create(assignRefId(
    createTransaction(
      { terminalId: BigInt(11), orderId: BigInt(21), amount: BigInt(100), callBackUrl: "https://merchant.test/callback" },
      clock,
      identifiers,
    ),
    "local-second",
    clock,
    identifiers,
  ));
  return { first, second, engine: new TransportFaultEngine() };
}

describe("TransportFaultEngine", () => {
  it("defaults to NORMAL, isolates transactions, and keeps unrelated operations pending", () => {
    const { first, second, engine } = fixture();
    expect(engine.getAssignment(first)).toBeUndefined();
    engine.assign(first, "POST_EXECUTION_HTTP_FAILURE", "bpVerifyRequest");

    expect(engine.claimPostExecution(first, "bpSettleRequest")).toBeUndefined();
    expect(engine.getAssignment(first)).toEqual({ profile: "POST_EXECUTION_HTTP_FAILURE", operation: "bpVerifyRequest" });
    expect(engine.getAssignment(second)).toBeUndefined();
  });

  it("rejects arbitrary profiles and operations without changing pending assignment", () => {
    const { first, engine } = fixture();
    expect(() => engine.assign(first, "HTTP_599", "bpVerifyRequest")).toThrow(expect.objectContaining({ code: "UNKNOWN_PROFILE" }));
    expect(() => engine.assign(first, "POST_EXECUTION_HTTP_FAILURE", "bpAnythingRequest")).toThrow(expect.objectContaining({ code: "UNKNOWN_OPERATION" }));
    expect(engine.getAssignment(first)).toBeUndefined();
  });

  it("claims each matching one-shot once and records separate safe diagnostics", () => {
    const { first, engine } = fixture();
    engine.assign(first, "PRE_EXECUTION_HTTP_FAILURE", "bpVerifyRequest");

    expect(engine.claimPreExecution(first, "bpVerifyRequest")).toEqual({
      profile: "PRE_EXECUTION_HTTP_FAILURE",
      operation: "bpVerifyRequest",
    });
    expect(engine.claimPreExecution(first, "bpVerifyRequest")).toBeUndefined();
    expect(engine.getAppliedEvents()).toEqual([{
      profile: "PRE_EXECUTION_HTTP_FAILURE",
      operation: "bpVerifyRequest",
      phase: "PRE_EXECUTION",
    }]);
  });

  it("clears without changing protocol transaction and synchronous claims cannot double-consume", async () => {
    const { first, engine } = fixture();
    engine.assign(first, "POST_EXECUTION_DELAY", "bpVerifyRequest");
    const claims = await Promise.all([
      Promise.resolve(engine.claimPostExecution(first, "bpVerifyRequest")),
      Promise.resolve(engine.claimPostExecution(first, "bpVerifyRequest")),
    ]);
    expect(claims.filter((claim) => claim !== undefined)).toHaveLength(1);

    engine.assign(first, "POST_EXECUTION_HTTP_FAILURE", "bpVerifyRequest");
    engine.clear(first);
    expect(engine.getAssignment(first)).toBeUndefined();
  });
});
