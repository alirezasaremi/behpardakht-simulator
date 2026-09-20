import type { ScenarioEngine, ScenarioName } from "@/server/scenarios";
import type { TransportFaultAssignment, TransportFaultEngine } from "@/server/transport";
import type { Transaction, TransactionEvent, TransactionRepository } from "@/server/transactions";

export const MAX_DASHBOARD_TRANSACTIONS = 100;
const DEFAULT_DASHBOARD_TRANSACTION_LIMIT = 50;

export type DashboardClassification = "PROTOCOL" | "SIMULATOR_INTERNAL" | "SIMULATOR_SCENARIO" | "UNSPECIFIED";

export type CallbackDiagnosticDto = Readonly<{
  attempted: boolean;
  status: "NOT_ATTEMPTED" | "SUCCEEDED" | "FAILED";
  attemptedAt?: string;
  completedAt?: string;
  failureCategory?: "DESTINATION_REJECTED" | "HTTP_NON_SUCCESS" | "TIMEOUT" | "TRANSPORT_ERROR";
  httpStatus?: number;
  classification: "SIMULATOR_INTERNAL";
}>;

export type PendingTransportFaultDto = Readonly<{
  profile: TransportFaultAssignment["profile"];
  operation: TransportFaultAssignment["operation"];
  consumption: "ONE_SHOT";
  classification: "SIMULATOR_SCENARIO";
}>;

export type DashboardTransactionListItem = Readonly<{
  transactionId: string;
  refId?: string;
  terminalId: string;
  orderId: string;
  saleOrderId?: string;
  saleReferenceId?: string;
  amount: string;
  saleState: Transaction["saleState"];
  verificationState: Transaction["verificationState"];
  settlementState: Transaction["settlementState"];
  reversalState: Transaction["reversalState"];
  lifecycleState: Transaction["lifecycleState"];
  callback: CallbackDiagnosticDto;
  scenario: ScenarioName;
  pendingTransportFault?: PendingTransportFaultDto;
  createdAt: string;
  updatedAt: string;
}>;

export type DashboardEventDto = Readonly<{
  eventId: string;
  at: string;
  type: TransactionEvent["type"];
  classification: DashboardClassification;
  metadata: Readonly<Record<string, string | number>>;
}>;

export type DashboardTransactionDetail = DashboardTransactionListItem & Readonly<{
  saleResCode?: string;
  saleCompletedAt?: string;
  verificationAttemptedAt?: string;
  verifiedAt?: string;
  settlementRequestedAt?: string;
  reversedAt?: string;
  events: readonly DashboardEventDto[];
}>;

export type DashboardSummary = Readonly<{
  transactionCount: number;
  successfulSales: number;
  verified: number;
  settlementRequested: number;
  knownReversed: number;
  semanticScenarios: number;
  pendingTransportFaults: number;
}>;

export type DashboardListResponse = Readonly<{
  classification: "SIMULATOR_INTERNAL";
  summary: DashboardSummary;
  transactions: readonly DashboardTransactionListItem[];
}>;

export type DashboardQueryDependencies = Readonly<{
  repository: TransactionRepository;
  scenarios: ScenarioEngine;
  transportFaults: TransportFaultEngine;
}>;

/**
 * SIMULATOR_INTERNAL read boundary. Every output field is intentionally mapped;
 * aggregate snapshots, callback URLs, credentials, raw requests, and errors are never serialized.
 */
export class DashboardQueryService {
  constructor(private readonly dependencies: DashboardQueryDependencies) {}

  list(limit = DEFAULT_DASHBOARD_TRANSACTION_LIMIT): DashboardListResponse {
    const transactions = this.allTransactions();
    const boundedLimit = Math.max(1, Math.min(limit, MAX_DASHBOARD_TRANSACTIONS));
    return {
      classification: "SIMULATOR_INTERNAL",
      summary: summaryFor(transactions, this.dependencies.scenarios, this.dependencies.transportFaults),
      transactions: transactions.slice(0, boundedLimit).map((transaction) => this.toListItem(transaction)),
    };
  }

  getById(transactionId: string): DashboardTransactionDetail | undefined {
    const transaction = this.dependencies.repository.getById(transactionId);
    return transaction === undefined ? undefined : this.toDetail(transaction);
  }

  private allTransactions(): Transaction[] {
    return [...this.dependencies.repository.list()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private toListItem(transaction: Transaction): DashboardTransactionListItem {
    const assignment = this.dependencies.transportFaults.getAssignment(transaction);
    return {
      transactionId: transaction.id,
      refId: transaction.refId,
      terminalId: transaction.terminalId.toString(),
      orderId: transaction.orderId.toString(),
      saleOrderId: optionalBigint(transaction.saleOrderId),
      saleReferenceId: optionalBigint(transaction.saleReferenceId),
      amount: transaction.amount.toString(),
      saleState: transaction.saleState,
      verificationState: transaction.verificationState,
      settlementState: transaction.settlementState,
      reversalState: transaction.reversalState,
      lifecycleState: transaction.lifecycleState,
      callback: callbackFor(transaction.events),
      scenario: this.dependencies.scenarios.getScenario(transaction),
      pendingTransportFault: assignment === undefined ? undefined : transportFaultFor(assignment),
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  private toDetail(transaction: Transaction): DashboardTransactionDetail {
    return {
      ...this.toListItem(transaction),
      saleResCode: transaction.saleResCode,
      saleCompletedAt: transaction.saleCompletedAt,
      verificationAttemptedAt: transaction.verificationAttemptedAt,
      verifiedAt: transaction.verifiedAt,
      settlementRequestedAt: transaction.settlementRequestedAt,
      reversedAt: transaction.reversedAt,
      events: transaction.events.map(eventFor),
    };
  }
}

function optionalBigint(value: bigint | undefined): string | undefined {
  return value === undefined ? undefined : value.toString();
}

function transportFaultFor(assignment: TransportFaultAssignment): PendingTransportFaultDto {
  return { ...assignment, consumption: "ONE_SHOT", classification: "SIMULATOR_SCENARIO" };
}

function summaryFor(
  transactions: readonly Transaction[],
  scenarios: ScenarioEngine,
  transportFaults: TransportFaultEngine,
): DashboardSummary {
  return {
    transactionCount: transactions.length,
    successfulSales: transactions.filter((transaction) => transaction.saleState === "SUCCEEDED").length,
    verified: transactions.filter((transaction) => transaction.verificationState === "VERIFIED").length,
    settlementRequested: transactions.filter((transaction) => transaction.settlementState === "REQUESTED").length,
    knownReversed: transactions.filter((transaction) => transaction.reversalState === "REVERSED").length,
    semanticScenarios: transactions.filter((transaction) => scenarios.getScenario(transaction) !== "NORMAL").length,
    pendingTransportFaults: transactions.filter((transaction) => transportFaults.getAssignment(transaction) !== undefined).length,
  };
}

function callbackFor(events: readonly TransactionEvent[]): CallbackDiagnosticDto {
  const attempted = events.findLast((event) => event.type === "CALLBACK_DISPATCH_ATTEMPTED");
  const completed = events.findLast(
    (event) => event.type === "CALLBACK_DISPATCH_SUCCEEDED" || event.type === "CALLBACK_DISPATCH_FAILED",
  );
  if (completed?.type === "CALLBACK_DISPATCH_SUCCEEDED") {
    return { attempted: true, status: "SUCCEEDED", attemptedAt: attempted?.at, completedAt: completed.at, httpStatus: completed.httpStatus, classification: "SIMULATOR_INTERNAL" };
  }
  if (completed?.type === "CALLBACK_DISPATCH_FAILED") {
    return {
      attempted: true,
      status: "FAILED",
      attemptedAt: attempted?.at,
      completedAt: completed.at,
      failureCategory: completed.reason,
      httpStatus: completed.httpStatus,
      classification: "SIMULATOR_INTERNAL",
    };
  }
  return { attempted: attempted !== undefined, status: "NOT_ATTEMPTED", attemptedAt: attempted?.at, classification: "SIMULATOR_INTERNAL" };
}

function eventFor(event: TransactionEvent): DashboardEventDto {
  const base = { eventId: event.id, at: event.at, type: event.type, classification: classificationFor(event), metadata: metadataFor(event) };
  return base;
}

function classificationFor(event: TransactionEvent): DashboardClassification {
  if (event.type === "SCENARIO_STATE_FORCED") return "SIMULATOR_SCENARIO";
  if (event.type.startsWith("CALLBACK_DISPATCH")) return "SIMULATOR_INTERNAL";
  return "PROTOCOL";
}

function metadataFor(event: TransactionEvent): Readonly<Record<string, string | number>> {
  switch (event.type) {
    case "TRANSACTION_CREATED": return { terminalId: event.terminalId.toString(), orderId: event.orderId.toString(), amount: event.amount.toString() };
    case "REF_ID_ASSIGNED": return { refId: event.refId };
    case "SALE_SUCCEEDED": return { refId: event.refId, saleOrderId: event.saleOrderId.toString(), saleReferenceId: event.saleReferenceId.toString() };
    case "SALE_NON_SUCCESS": return { refId: event.refId, resCode: event.resCode, saleOrderId: event.saleOrderId.toString(), saleReferenceId: event.saleReferenceId.toString() };
    case "CALLBACK_DISPATCH_SUCCEEDED": return { httpStatus: event.httpStatus };
    case "CALLBACK_DISPATCH_FAILED": return event.httpStatus === undefined ? { reason: event.reason } : { reason: event.reason, httpStatus: event.httpStatus };
    case "SETTLEMENT_REQUESTED": return { via: event.via };
    case "SCENARIO_STATE_FORCED": return { scenario: event.scenario };
    default: return {};
  }
}
