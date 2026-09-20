import { describe, expect, it } from "vitest";
import {
  InMemoryTransactionRepository,
  ManualClock,
  SequenceIdentifierGenerator,
  assignRefId,
  createTransaction,
  recordSaleSucceeded,
  recordSettlementRequested,
  recordVerificationConfirmed,
  recordVerifyAttempted,
} from "@/server/transactions";
import { BpVerifyRequestHandler, BpVerifySettleRequestHandler } from "@/server/protocol";
import { ScenarioEngine } from "./engine";

function fixture() {
  const repository = new InMemoryTransactionRepository();
  const clock = new ManualClock(new Date("2026-01-01T00:00:00.000Z"));
  const identifiers = new SequenceIdentifierGenerator();
  const createSold = (orderId: bigint, refId: string, saleReferenceId: bigint) =>
    repository.save(
      recordSaleSucceeded(
        repository.create(
          assignRefId(
            createTransaction(
              { terminalId: BigInt(10), orderId, amount: BigInt(100), callBackUrl: "https://merchant.test/callback" },
              clock,
              identifiers,
            ),
            refId,
            clock,
            identifiers,
          ),
        ),
        { refId, saleOrderId: orderId, saleReferenceId },
        clock,
        identifiers,
      ),
    );
  const first = createSold(BigInt(20), "local-first", BigInt(30));
  const second = createSold(BigInt(21), "local-second", BigInt(31));
  return { repository, clock, identifiers, first, second, engine: new ScenarioEngine({ repository, clock, identifiers }) };
}

describe("ScenarioEngine", () => {
  it("defaults every transaction to NORMAL and isolates assignments", () => {
    const { engine, first, second } = fixture();

    expect(engine.getScenario(first)).toBe("NORMAL");
    engine.assignScenario(first, "VERIFY_UNRESOLVED");
    expect(engine.getScenario(first)).toBe("VERIFY_UNRESOLVED");
    expect(engine.getScenario(second)).toBe("NORMAL");
    engine.assignScenario(first, "NORMAL");
    expect(engine.getScenario(first)).toBe("NORMAL");
  });

  it("rejects unknown scenario without changing transaction or registry", () => {
    const { engine, repository, first } = fixture();
    const before = repository.getById(first.id);

    expect(() => engine.assignScenario(first, "RETURN_ANYTHING")).toThrow(
      expect.objectContaining({ code: "UNKNOWN_SCENARIO" }),
    );
    expect(repository.getById(first.id)).toEqual(before);
    expect(engine.getScenario(first)).toBe("NORMAL");
  });

  it("clears configuration without rolling back lifecycle history", () => {
    const { engine, repository, first } = fixture();
    const reversed = engine.assignScenario(first, "KNOWN_REVERSED");

    expect(reversed).toMatchObject({ lifecycleState: "REVERSED", reversalState: "REVERSED" });
    expect(reversed.events.at(-1)).toMatchObject({ type: "SCENARIO_STATE_FORCED", scenario: "KNOWN_REVERSED" });
    engine.clearScenario(reversed);

    expect(engine.getScenario(reversed)).toBe("NORMAL");
    expect(repository.getById(first.id)).toMatchObject({ lifecycleState: "REVERSED", reversalState: "REVERSED" });
  });

  it("forces known reversed only from coherent local lifecycle and never fakes Reversal request", () => {
    const { engine, repository, clock, identifiers, first } = fixture();
    const reversed = engine.assignScenario(first, "KNOWN_REVERSED");
    const before = repository.getById(reversed.id);

    expect(reversed.events.some((event) => event.type === "REVERSAL_COMPLETED")).toBe(false);
    expect(() => engine.assignScenario(reversed, "KNOWN_REVERSED")).toThrow(
      expect.objectContaining({ code: "KNOWN_REVERSED_NOT_ELIGIBLE" }),
    );
    expect(repository.getById(reversed.id)).toEqual(before);

    const input = {
      terminalId: BigInt(10), userName: "local", userPassword: "fake", orderId: BigInt(20), saleOrderId: BigInt(20), saleReferenceId: BigInt(30),
    };
    expect(new BpVerifyRequestHandler({ repository, clock, identifiers }).execute(input).result).toBe("48");
    expect(new BpVerifySettleRequestHandler({ repository, clock, identifiers }).execute(input).result).toBe("48");
  });

  it("rejects forcing known reversed after settlement without mutation", () => {
    const { engine, repository, clock, identifiers, first } = fixture();
    const settled = repository.save(
      recordSettlementRequested(
        recordVerificationConfirmed(recordVerifyAttempted(first, clock, identifiers), clock, identifiers),
        clock,
        identifiers,
      ),
    );
    const before = repository.getById(settled.id);

    expect(() => engine.assignScenario(settled, "KNOWN_REVERSED")).toThrow(
      expect.objectContaining({ code: "KNOWN_REVERSED_NOT_ELIGIBLE" }),
    );
    expect(repository.getById(settled.id)).toEqual(before);
    expect(engine.getScenario(settled)).toBe("NORMAL");
  });

  it("keeps VERIFY_UNRESOLVED deterministic until clear, then permits normal Verify", () => {
    const { engine, repository, clock, identifiers, first } = fixture();
    const handler = new BpVerifyRequestHandler({ repository, clock, identifiers, scenarios: engine });
    const input = {
      terminalId: BigInt(10), userName: "local", userPassword: "fake", orderId: BigInt(20), saleOrderId: BigInt(20), saleReferenceId: BigInt(30),
    };
    engine.assignScenario(first, "VERIFY_UNRESOLVED");

    expect(() => handler.execute(input)).toThrow(expect.objectContaining({ code: "VERIFY_UNRESOLVED_SCENARIO" }));
    expect(() => handler.execute(input)).toThrow(expect.objectContaining({ code: "VERIFY_UNRESOLVED_SCENARIO" }));
    expect(repository.getById(first.id)?.verificationState).toBe("ATTEMPTED");
    expect(repository.getById(first.id)?.events.filter((event) => event.type === "VERIFY_ATTEMPTED")).toHaveLength(2);

    engine.clearScenario(first);
    expect(handler.execute(input).result).toBe("0");
    expect(repository.getById(first.id)?.verificationState).toBe("VERIFIED");
  });
});
