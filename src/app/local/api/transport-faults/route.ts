import { localSimulator } from "@/server/local-simulator";
import {
  isTransportFaultOperation,
  isTransportFaultProfile,
  transportFaultOperations,
  transportFaultProfiles,
  TransportFaultEngineError,
} from "@/server/transport";

export const runtime = "nodejs";

const MAX_CONTROL_BODY_BYTES = 1_024;

/** SIMULATOR_SCENARIO local-only control; never a Behpardakht SOAP field. */
export function GET(): Response {
  return json({
    classification: "SIMULATOR_SCENARIO",
    profiles: transportFaultProfiles,
    operations: transportFaultOperations,
    consumption: "ONE_SHOT",
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = await readControlBody(request);
  if (body instanceof Response) {
    return body;
  }
  if (
    !hasExactKeys(body, ["refId", "profile", "operation"]) ||
    typeof body.refId !== "string" ||
    !isBoundedRefId(body.refId) ||
    typeof body.profile !== "string" ||
    !isTransportFaultProfile(body.profile) ||
    typeof body.operation !== "string" ||
    !isTransportFaultOperation(body.operation)
  ) {
    return error(400, "Invalid transport fault assignment.");
  }
  const transaction = localSimulator.repository.getByRefId(body.refId);
  if (transaction === undefined) {
    return error(404, "Unknown RefId.");
  }
  try {
    localSimulator.transportFaults.assign(transaction, body.profile, body.operation);
    return json({ refId: body.refId, profile: body.profile, operation: body.operation, consumption: "ONE_SHOT" });
  } catch (caught) {
    if (caught instanceof TransportFaultEngineError) {
      return error(400, "Invalid transport fault assignment.");
    }
    return error(500, "Local transport fault control failed.");
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const body = await readControlBody(request);
  if (body instanceof Response) {
    return body;
  }
  if (!hasExactKeys(body, ["refId"]) || typeof body.refId !== "string" || !isBoundedRefId(body.refId)) {
    return error(400, "Invalid transport fault clear request.");
  }
  const transaction = localSimulator.repository.getByRefId(body.refId);
  if (transaction === undefined) {
    return error(404, "Unknown RefId.");
  }
  localSimulator.transportFaults.clear(transaction);
  return json({ refId: body.refId, profile: "NORMAL" });
}

async function readControlBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return error(415, "Transport fault control requires application/json.");
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_CONTROL_BODY_BYTES)) {
    return error(413, "Transport fault control body is too large.");
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return error(400, "Invalid transport fault control body.");
  }
  if (new TextEncoder().encode(text).byteLength > MAX_CONTROL_BODY_BYTES) {
    return error(413, "Transport fault control body is too large.");
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : error(400, "Invalid transport fault control body.");
  } catch {
    return error(400, "Invalid transport fault control body.");
  }
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isBoundedRefId(value: string): boolean {
  return value.length > 0 && value.length <= 256;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
