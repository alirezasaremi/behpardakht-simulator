import { localSimulator } from "@/server/local-simulator";
import { isScenarioName, scenarioNames, ScenarioEngineError } from "@/server/scenarios";

export const runtime = "nodejs";

const MAX_CONTROL_BODY_BYTES = 1_024;

/** SIMULATOR_SCENARIO local-only control surface. Never part of SOAP protocol. */
export function GET(): Response {
  return json({ classification: "SIMULATOR_SCENARIO", scenarios: scenarioNames });
}

export async function POST(request: Request): Promise<Response> {
  const body = await readControlBody(request);
  if (body instanceof Response) {
    return body;
  }
  if (!hasExactKeys(body, ["refId", "scenario"]) || typeof body.refId !== "string" || !isBoundedRefId(body.refId) || typeof body.scenario !== "string" || !isScenarioName(body.scenario)) {
    return error(400, "Invalid scenario assignment.");
  }

  const transaction = localSimulator.repository.getByRefId(body.refId);
  if (transaction === undefined) {
    return error(404, "Unknown RefId.");
  }
  try {
    const updated = localSimulator.scenarios.assignScenario(transaction, body.scenario);
    return json({ refId: body.refId, scenario: localSimulator.scenarios.getScenario(updated), lifecycleState: updated.lifecycleState });
  } catch (caught) {
    if (caught instanceof ScenarioEngineError) {
      return error(409, "Scenario is not eligible for this local transaction.");
    }
    return error(500, "Local scenario control failed.");
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const body = await readControlBody(request);
  if (body instanceof Response) {
    return body;
  }
  if (!hasExactKeys(body, ["refId"]) || typeof body.refId !== "string" || !isBoundedRefId(body.refId)) {
    return error(400, "Invalid scenario clear request.");
  }
  const transaction = localSimulator.repository.getByRefId(body.refId);
  if (transaction === undefined) {
    return error(404, "Unknown RefId.");
  }
  localSimulator.scenarios.clearScenario(transaction);
  return json({ refId: body.refId, scenario: "NORMAL", lifecycleState: transaction.lifecycleState });
}

async function readControlBody(request: Request): Promise<Record<string, unknown> | Response> {
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return error(415, "Scenario control requires application/json.");
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_CONTROL_BODY_BYTES)) {
    return error(413, "Scenario control body is too large.");
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return error(400, "Invalid scenario control body.");
  }
  if (new TextEncoder().encode(text).byteLength > MAX_CONTROL_BODY_BYTES) {
    return error(413, "Scenario control body is too large.");
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : error(400, "Invalid scenario control body.");
  } catch {
    return error(400, "Invalid scenario control body.");
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
