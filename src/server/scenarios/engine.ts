import {
  TransactionDomainError,
  recordScenarioKnownReversed,
  type Clock,
  type IdentifierGenerator,
  type Transaction,
  type TransactionRepository,
} from "@/server/transactions";

/** SIMULATOR_SCENARIO: bounded semantic conditions available to local tests. */
export const scenarioNames = ["NORMAL", "VERIFY_UNRESOLVED", "KNOWN_REVERSED"] as const;
export type ScenarioName = (typeof scenarioNames)[number];

/** Minimal read boundary used by protocol handlers after correlation. */
export interface ScenarioPolicy {
  getScenario(transaction: Transaction): ScenarioName;
}

/** Default policy. It deliberately has no observable protocol effect. */
export class NormalScenarioPolicy implements ScenarioPolicy {
  getScenario(): ScenarioName {
    return "NORMAL";
  }
}

export class ScenarioEngineError extends Error {
  constructor(
    readonly code: "UNKNOWN_SCENARIO" | "KNOWN_REVERSED_NOT_ELIGIBLE",
    message: string,
  ) {
    super(message);
    this.name = "ScenarioEngineError";
  }
}

export type ScenarioEngineDependencies = Readonly<{
  repository: TransactionRepository;
  clock: Clock;
  identifiers: IdentifierGenerator;
}>;

/**
 * SIMULATOR_SCENARIO process-memory registry. Scenario choice is separate from
 * transaction protocol state; only KNOWN_REVERSED records its explicit forced
 * lifecycle result in the aggregate.
 */
export class ScenarioEngine implements ScenarioPolicy {
  private readonly assigned = new Map<string, Exclude<ScenarioName, "NORMAL">>();

  constructor(private readonly dependencies: ScenarioEngineDependencies) {}

  getScenario(transaction: Transaction): ScenarioName {
    return this.assigned.get(transaction.id) ?? "NORMAL";
  }

  assignScenario(transaction: Transaction, scenario: ScenarioName | string): Transaction {
    if (!isScenarioName(scenario)) {
      throw new ScenarioEngineError("UNKNOWN_SCENARIO", "Scenario is not supported by local simulator.");
    }
    if (scenario === "NORMAL") {
      this.clearScenario(transaction);
      return transaction;
    }
    if (scenario === "VERIFY_UNRESOLVED") {
      this.assigned.set(transaction.id, scenario);
      return transaction;
    }

    try {
      const reversed = recordScenarioKnownReversed(
        transaction,
        this.dependencies.clock,
        this.dependencies.identifiers,
      );
      const saved = this.dependencies.repository.save(reversed);
      this.assigned.set(transaction.id, scenario);
      return saved;
    } catch (error) {
      if (!(error instanceof TransactionDomainError)) {
        throw error;
      }
      throw new ScenarioEngineError(
        "KNOWN_REVERSED_NOT_ELIGIBLE",
        "Known reversed scenario requires successful Sale with unresolved verification and no settlement.",
      );
    }
  }

  clearScenario(transaction: Transaction): void {
    this.assigned.delete(transaction.id);
  }
}

export function isScenarioName(value: string): value is ScenarioName {
  return scenarioNames.some((scenario) => scenario === value);
}
