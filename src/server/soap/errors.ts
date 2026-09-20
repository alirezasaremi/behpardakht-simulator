export type SoapInputErrorCode =
  | "REQUEST_TOO_LARGE"
  | "DTD_NOT_ALLOWED"
  | "MALFORMED_XML"
  | "UNSUPPORTED_ENVELOPE"
  | "UNSUPPORTED_OPERATION"
  | "INVALID_PAY_REQUEST";

/** SIMULATOR_INTERNAL local transport/validation error; never a provider ResCode. */
export class SoapInputError extends Error {
  constructor(readonly code: SoapInputErrorCode, message: string) {
    super(message);
    this.name = "SoapInputError";
  }
}
