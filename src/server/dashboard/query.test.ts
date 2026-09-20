import { describe, expect, it } from "vitest";
import { DashboardQueryService } from "./query";
import { ManualClock, SequenceIdentifierGenerator, InMemoryTransactionRepository, assignRefId, createTransaction, recordSaleSucceeded } from "@/server/transactions";
import { ScenarioEngine } from "@/server/scenarios";
import { TransportFaultEngine } from "@/server/transport";

function fixture() {
  const clock = new ManualClock(new Date("2026-01-01T00:00:00.000Z"));
  const identifiers = new SequenceIdentifierGenerator();
  const repository = new InMemoryTransactionRepository();
  const scenarios = new ScenarioEngine({ repository, clock, identifiers });
  const transportFaults = new TransportFaultEngine();
  const transaction = createTransaction({ terminalId: BigInt("9007199254740993"), orderId: BigInt("9007199254740995"), amount: BigInt("12345678901234567890"), callBackUrl: "https://merchant.test/private?token=no" }, clock, identifiers);
  repository.create(transaction);
  const withRefId = assignRefId(transaction, "CaseSensitive-RefId", clock, identifiers);
  repository.save(withRefId);
  return { repository, scenarios, transportFaults, transaction: withRefId, queries: new DashboardQueryService({ repository, scenarios, transportFaults }) };
}

describe("DashboardQueryService", () => {
  it("maps an explicit safe, bigint-safe transaction list without reading callback URL or credentials", () => {
    const { queries } = fixture();
    const response = queries.list();
    expect(response.transactions).toHaveLength(1);
    expect(response.transactions[0]).toMatchObject({
      refId: "CaseSensitive-RefId",
      terminalId: "9007199254740993",
      orderId: "9007199254740995",
      amount: "12345678901234567890",
      saleState: "PENDING",
      scenario: "NORMAL",
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toMatch(/password|callbackurl|raw.?xml|cvv|pin|otp/i);
  });

  it("maps lifecycle, callback, scenario, pending fault, and safe event metadata", () => {
    const { repository, scenarios, transportFaults, transaction, queries } = fixture();
    const sold = recordSaleSucceeded(transaction, { refId: "CaseSensitive-RefId", saleOrderId: BigInt("9007199254740995"), saleReferenceId: BigInt(10) }, new ManualClock(new Date("2026-01-01T00:01:00.000Z")), new SequenceIdentifierGenerator());
    repository.save(sold);
    scenarios.assignScenario(sold, "VERIFY_UNRESOLVED");
    transportFaults.assign(sold, "POST_EXECUTION_HTTP_FAILURE", "bpVerifyRequest");
    const detail = queries.getById(sold.id);
    expect(detail).toMatchObject({ lifecycleState: "SALE_SUCCEEDED", scenario: "VERIFY_UNRESOLVED", pendingTransportFault: { profile: "POST_EXECUTION_HTTP_FAILURE", operation: "bpVerifyRequest" }, callback: { status: "NOT_ATTEMPTED" } });
    expect(detail?.events.find((event) => event.type === "TRANSACTION_CREATED")).toMatchObject({
      metadata: { terminalId: "9007199254740993", amount: "12345678901234567890" },
    });
    expect(detail?.events.find((event) => event.type === "SALE_SUCCEEDED")).toMatchObject({ metadata: { saleReferenceId: "10" } });
  });

  it("keeps all dashboard reads pure: no events, scenario, or one-shot fault change", () => {
    const { repository, scenarios, transportFaults, transaction, queries } = fixture();
    scenarios.assignScenario(transaction, "VERIFY_UNRESOLVED");
    transportFaults.assign(transaction, "PRE_EXECUTION_HTTP_FAILURE", "bpVerifyRequest");
    const before = repository.getById(transaction.id)!;
    queries.list(1);
    queries.getById(transaction.id);
    const after = repository.getById(transaction.id)!;
    expect(after).toEqual(before);
    expect(scenarios.getScenario(after)).toBe("VERIFY_UNRESOLVED");
    expect(transportFaults.getAssignment(after)).toEqual({ profile: "PRE_EXECUTION_HTTP_FAILURE", operation: "bpVerifyRequest" });
  });

  it("bounds list output and returns no result for unknown local transaction", () => {
    const { queries } = fixture();
    expect(queries.list(999).transactions).toHaveLength(1);
    expect(queries.getById("missing")).toBeUndefined();
  });
});
