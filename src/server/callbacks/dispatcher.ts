import { buildCallbackPayload, type CallbackPayload } from "./payload";
import type { Transaction } from "@/server/transactions";

export const DEFAULT_CALLBACK_TIMEOUT_MS = 3_000;
export const DEFAULT_CALLBACK_RESPONSE_MAX_BYTES = 16_384;

export type CallbackDispatchResult =
  | Readonly<{ kind: "SUCCEEDED"; httpStatus: number }>
  | Readonly<{
      kind: "FAILED";
      reason: "DESTINATION_REJECTED" | "HTTP_NON_SUCCESS" | "TIMEOUT" | "TRANSPORT_ERROR";
      httpStatus?: number;
    }>;

export type FetchLike = (input: URL, init: RequestInit) => Promise<Response>;

export type CallbackDispatcherDependencies = Readonly<{
  allowedOrigins: ReadonlySet<string>;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  responseMaxBytes?: number;
}>;

/**
 * SIMULATOR_INTERNAL SSRF boundary. Origin equality is deliberate: it requires
 * explicit host, scheme, and port approval. It cannot defeat later DNS rebinding.
 */
export class CallbackDispatcher {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly responseMaxBytes: number;

  constructor(private readonly dependencies: CallbackDispatcherDependencies) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
    this.timeoutMs = dependencies.timeoutMs ?? DEFAULT_CALLBACK_TIMEOUT_MS;
    this.responseMaxBytes = dependencies.responseMaxBytes ?? DEFAULT_CALLBACK_RESPONSE_MAX_BYTES;
  }

  async dispatch(transaction: Transaction): Promise<CallbackDispatchResult> {
    const destination = validateCallbackDestination(transaction.callBackUrl, this.dependencies.allowedOrigins);
    if (destination === undefined) {
      return { kind: "FAILED", reason: "DESTINATION_REJECTED" };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const payload = buildCallbackPayload(transaction);
      const response = await this.fetchImpl(destination, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: encodeCallbackPayload(payload),
        redirect: "error",
        signal: controller.signal,
      });
      await consumeBoundedResponse(response, this.responseMaxBytes);
      if (response.ok) {
        return { kind: "SUCCEEDED", httpStatus: response.status };
      }
      return { kind: "FAILED", reason: "HTTP_NON_SUCCESS", httpStatus: response.status };
    } catch {
      return controller.signal.aborted
        ? { kind: "FAILED", reason: "TIMEOUT" }
        : { kind: "FAILED", reason: "TRANSPORT_ERROR" };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** SIMULATOR_INTERNAL: comma-separated exact origins; empty/malformed config allows nothing. */
export function callbackAllowedOriginsFromEnvironment(value = process.env.SIMULATOR_CALLBACK_ALLOWED_ORIGINS): ReadonlySet<string> {
  if (value === undefined || value.trim().length === 0) {
    return new Set();
  }

  const origins = new Set<string>();
  for (const rawOrigin of value.split(",")) {
    try {
      const url = new URL(rawOrigin.trim());
      if (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.username.length === 0 &&
        url.password.length === 0 &&
        url.pathname === "/" &&
        url.search.length === 0 &&
        url.hash.length === 0
      ) {
        origins.add(url.origin);
      }
    } catch {
      // Invalid configured entries receive no trust.
    }
  }
  return origins;
}

export function validateCallbackDestination(value: string, allowedOrigins: ReadonlySet<string>): URL | undefined {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      !allowedOrigins.has(url.origin)
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

export function encodeCallbackPayload(payload: CallbackPayload): string {
  return new URLSearchParams(payload).toString();
}

async function consumeBoundedResponse(response: Response, maximumBytes: number): Promise<void> {
  if (response.body === null) {
    return;
  }
  const reader = response.body.getReader();
  let consumed = 0;
  try {
    while (consumed <= maximumBytes) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      consumed += value.byteLength;
      if (consumed > maximumBytes) {
        await reader.cancel();
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
