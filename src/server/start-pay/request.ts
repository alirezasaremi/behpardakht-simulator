export const MAX_START_PAY_REQUEST_BYTES = 8_192;

export class StartPayInputError extends Error {
  constructor(readonly code: "INVALID_CONTENT_TYPE" | "INVALID_FORM", message: string) {
    super(message);
    this.name = "StartPayInputError";
  }
}

/**
 * PROTOCOL: v1.39 printed pages 14 and 18-20 show POST with RefId.
 * SIMULATOR_INTERNAL: local endpoint accepts bounded URL-encoded form data only.
 */
export async function extractStartPayRefId(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    throw new StartPayInputError("INVALID_CONTENT_TYPE", "Local StartPay requires URL-encoded form data.");
  }
  const body = await readBoundedRequestBody(request, MAX_START_PAY_REQUEST_BYTES);
  const form = new URLSearchParams(body);
  if (
    form.size !== 1 ||
    form.getAll("RefId").length !== 1 ||
    Array.from(form.keys()).some((name) => name !== "RefId")
  ) {
    throw new StartPayInputError("INVALID_FORM", "Local StartPay requires exactly one RefId field.");
  }
  const refId = form.get("RefId");
  if (refId === null || refId.length === 0 || refId.length > 256) {
    throw new StartPayInputError("INVALID_FORM", "Local StartPay requires a bounded RefId value.");
  }
  return refId;
}

export async function extractPaymentOutcome(request: Request): Promise<"SUCCESS" | "NON_SUCCESS"> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    throw new StartPayInputError("INVALID_CONTENT_TYPE", "Local payment action requires URL-encoded form data.");
  }
  const body = await readBoundedRequestBody(request, MAX_START_PAY_REQUEST_BYTES);
  const form = new URLSearchParams(body);
  if (form.size !== 1 || form.getAll("outcome").length !== 1) {
    throw new StartPayInputError("INVALID_FORM", "Local payment action requires exactly one outcome.");
  }
  const outcome = form.get("outcome");
  if (outcome === "SUCCESS" || outcome === "NON_SUCCESS") {
    return outcome;
  }
  throw new StartPayInputError("INVALID_FORM", "Local payment action received an unsupported outcome.");
}

/** SIMULATOR_INTERNAL same-origin local form boundary; absent Origin remains usable for controlled test clients. */
export function hasTrustedLocalFormOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) {
    return true;
  }

  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) {
    return true;
  }

  // Next development hosts can canonicalize Request.url to localhost while a
  // browser legitimately uses 127.0.0.1. Compare the browser Origin with the
  // actual inbound Host as well, never with an arbitrary caller-provided URL.
  const host = request.headers.get("host");
  if (host === null) {
    return false;
  }
  return origin === originForHost("http", host) || origin === originForHost("https", host);
}

function originForHost(scheme: "http" | "https", host: string): string | undefined {
  try {
    return new URL(`${scheme}://${host}`).origin;
  } catch {
    return undefined;
  }
}

async function readBoundedRequestBody(request: Request, maximumBytes: number): Promise<string> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBytes)) {
    throw new StartPayInputError("INVALID_FORM", "Local StartPay request exceeds size limit.");
  }
  if (request.body === null) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new StartPayInputError("INVALID_FORM", "Local StartPay request exceeds size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new StartPayInputError("INVALID_FORM", "Local StartPay request is not valid UTF-8.");
  }
}
