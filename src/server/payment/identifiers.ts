import { randomBytes } from "node:crypto";
import type { SaleReferenceIdGenerator } from "./service";

const MINIMUM_SALE_REFERENCE_ID = BigInt("100000000000");
const SALE_REFERENCE_ID_RANGE = BigInt("900000000000");

/** SIMULATOR_INTERNAL opaque decimal-long generator. It encodes no secrets or protocol algorithm. */
export class RandomSaleReferenceIdGenerator implements SaleReferenceIdGenerator {
  nextSaleReferenceId(): bigint {
    const random = BigInt(`0x${randomBytes(8).toString("hex")}`);
    return MINIMUM_SALE_REFERENCE_ID + (random % SALE_REFERENCE_ID_RANGE);
  }
}

export class SequenceSaleReferenceIdGenerator implements SaleReferenceIdGenerator {
  private sequence = BigInt(0);

  nextSaleReferenceId(): bigint {
    this.sequence += BigInt(1);
    return this.sequence;
  }
}
