import { randomUUID } from "node:crypto";

/** SIMULATOR_INTERNAL identifier boundary. Formats are not Behpardakht protocol. */
export interface IdentifierGenerator {
  nextTransactionId(): string;
  nextEventId(): string;
}

export class RandomIdentifierGenerator implements IdentifierGenerator {
  nextTransactionId(): string {
    return `txn_${randomUUID()}`;
  }

  nextEventId(): string {
    return `evt_${randomUUID()}`;
  }
}

export class SequenceIdentifierGenerator implements IdentifierGenerator {
  private transactionSequence = 0;
  private eventSequence = 0;

  nextTransactionId(): string {
    this.transactionSequence += 1;
    return `txn_test_${this.transactionSequence}`;
  }

  nextEventId(): string {
    this.eventSequence += 1;
    return `evt_test_${this.eventSequence}`;
  }
}
