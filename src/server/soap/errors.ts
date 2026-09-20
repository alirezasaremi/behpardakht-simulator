export type SoapInputErrorCode =
  | "REQUEST_TOO_LARGE"
  | "DTD_NOT_ALLOWED"
  | "MALFORMED_XML"
  | "UNSUPPORTED_ENVELOPE"
  | "UNSUPPORTED_OPERATION"
  | "INVALID_INQUIRY_REQUEST"
  | "INVALID_PAY_REQUEST"
  | "INVALID_REVERSAL_REQUEST"
  | "INVALID_SETTLE_REQUEST"
  | "INVALID_VERIFY_REQUEST"
  | "INVALID_VERIFY_SETTLE_REQUEST";

/** SIMULATOR_INTERNAL local transport/validation error; never a provider ResCode. */
export class SoapInputError extends Error {
  constructor(readonly code: SoapInputErrorCode, message: string) {
    super(message);
    this.name = "SoapInputError";
  }
}
