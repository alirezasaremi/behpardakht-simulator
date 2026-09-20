import type { Transaction } from "@/server/transactions";

/** SIMULATOR_SCENARIO: bounded merchant-to-gateway transport observations. */
export const transportFaultProfiles = [
  "NORMAL",
  "PRE_EXECUTION_HTTP_FAILURE",
  "POST_EXECUTION_HTTP_FAILURE",
  "POST_EXECUTION_MALFORMED_SOAP",
  "POST_EXECUTION_DELAY",
] as const;
export type TransportFaultProfile = (typeof transportFaultProfiles)[number];
type AssignedTransportFaultProfile = Exclude<TransportFaultProfile, "NORMAL">;

/** Only operations that can correlate an existing Pay transaction are selectable. */
export const transportFaultOperations = ["bpVerifyRequest", "bpSettleRequest", "bpVerifySettleRequest"] as const;
export type TransportFaultOperation = (typeof transportFaultOperations)[number];

export type TransportFaultPhase = "PRE_EXECUTION" | "POST_EXECUTION";

export type TransportFaultAssignment = Readonly<{
  profile: AssignedTransportFaultProfile;
  operation: TransportFaultOperation;
}>;

export type TransportFaultEvent = Readonly<{
  profile: AssignedTransportFaultProfile;
  operation: TransportFaultOperation;
  phase: TransportFaultPhase;
}>;

export class TransportFaultEngineError extends Error {
  constructor(
    readonly code: "UNKNOWN_PROFILE" | "UNKNOWN_OPERATION",
    message: string,
  ) {
    super(message);
    this.name = "TransportFaultEngineError";
  }
}

/**
 * SIMULATOR_SCENARIO process-memory, transaction-scoped, one-shot registry.
 * Its diagnostic history is deliberately outside transaction protocol events.
 */
export class TransportFaultEngine {
  private readonly assigned = new Map<string, TransportFaultAssignment>();
  private readonly applied: TransportFaultEvent[] = [];

  assign(
    transaction: Transaction,
    profile: TransportFaultProfile | string,
    operation: TransportFaultOperation | string,
  ): void {
    if (!isTransportFaultProfile(profile)) {
      throw new TransportFaultEngineError("UNKNOWN_PROFILE", "Transport fault profile is not supported by local simulator.");
    }
    if (!isTransportFaultOperation(operation)) {
      throw new TransportFaultEngineError("UNKNOWN_OPERATION", "Transport fault operation is not supported by local simulator.");
    }
    if (profile === "NORMAL") {
      this.clear(transaction);
      return;
    }
    this.assigned.set(transaction.id, { profile, operation });
  }

  getAssignment(transaction: Transaction): TransportFaultAssignment | undefined {
    return this.assigned.get(transaction.id);
  }

  clear(transaction: Transaction): void {
    this.assigned.delete(transaction.id);
  }

  /** Claim before protocol execution. Claim is synchronous and one-shot. */
  claimPreExecution(transaction: Transaction, operation: TransportFaultOperation): TransportFaultAssignment | undefined {
    return this.claim(transaction, operation, "PRE_EXECUTION");
  }

  /** Claim only after successful protocol execution and normal result creation. */
  claimPostExecution(transaction: Transaction, operation: TransportFaultOperation): TransportFaultAssignment | undefined {
    return this.claim(transaction, operation, "POST_EXECUTION");
  }

  getAppliedEvents(): readonly TransportFaultEvent[] {
    return this.applied;
  }

  private claim(
    transaction: Transaction,
    operation: TransportFaultOperation,
    phase: TransportFaultPhase,
  ): TransportFaultAssignment | undefined {
    const assignment = this.assigned.get(transaction.id);
    if (assignment === undefined || assignment.operation !== operation || phaseFor(assignment.profile) !== phase) {
      return undefined;
    }
    this.assigned.delete(transaction.id);
    this.applied.push({ profile: assignment.profile, operation, phase });
    return assignment;
  }
}

export function isTransportFaultProfile(value: string): value is TransportFaultProfile {
  return transportFaultProfiles.some((profile) => profile === value);
}

export function isTransportFaultOperation(value: string): value is TransportFaultOperation {
  return transportFaultOperations.some((operation) => operation === value);
}

export function phaseFor(profile: AssignedTransportFaultProfile): TransportFaultPhase {
  return profile === "PRE_EXECUTION_HTTP_FAILURE" ? "PRE_EXECUTION" : "POST_EXECUTION";
}
