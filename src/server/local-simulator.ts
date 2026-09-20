import { CallbackDispatcher, callbackAllowedOriginsFromEnvironment } from "@/server/callbacks";
import { RandomSaleReferenceIdGenerator, LocalPaymentService } from "@/server/payment";
import { RandomRefIdGenerator } from "@/server/protocol";
import { ScenarioEngine } from "@/server/scenarios";
import { LocalSoapService } from "@/server/soap";
import { InMemoryTransactionRepository, RandomIdentifierGenerator, SystemClock } from "@/server/transactions";

/** SIMULATOR_INTERNAL composition root. One in-memory instance serves local app routes. */
export function createLocalSimulator() {
  const repository = new InMemoryTransactionRepository();
  const clock = new SystemClock();
  const identifiers = new RandomIdentifierGenerator();
  const callbacks = new CallbackDispatcher({ allowedOrigins: callbackAllowedOriginsFromEnvironment() });
  const scenarios = new ScenarioEngine({ repository, clock, identifiers });
  return {
    repository,
    scenarios,
    soap: new LocalSoapService({ repository, clock, identifiers, refIds: new RandomRefIdGenerator(), scenarios }),
    payments: new LocalPaymentService({
      repository,
      clock,
      identifiers,
      saleReferenceIds: new RandomSaleReferenceIdGenerator(),
      callbacks,
    }),
  };
}

type LocalSimulator = ReturnType<typeof createLocalSimulator>;

/**
 * SIMULATOR_INTERNAL process-wide in-memory store. App Router route bundles can
 * evaluate this module independently during development; globalThis preserves
 * one local simulator process without adding database/infrastructure state.
 */
const localSimulatorGlobal = globalThis as typeof globalThis & { __behpardakhtLocalSimulator__?: LocalSimulator };

export const localSimulator =
  localSimulatorGlobal.__behpardakhtLocalSimulator__ ??
  (localSimulatorGlobal.__behpardakhtLocalSimulator__ = createLocalSimulator());
