import { DashboardQueryService, MAX_DASHBOARD_TRANSACTIONS } from "@/server/dashboard";
import { localSimulator } from "@/server/local-simulator";

export const runtime = "nodejs";

const queries = new DashboardQueryService(localSimulator);

/** SIMULATOR_INTERNAL local dashboard read route. It never writes aggregate or control state. */
export function GET(request: Request): Response {
  const parsed = new URL(request.url).searchParams.get("limit");
  const limit = parsed === null ? undefined : parseLimit(parsed);
  if (parsed !== null && limit === undefined) {
    return Response.json({ error: `limit must be an integer from 1 to ${MAX_DASHBOARD_TRANSACTIONS}.` }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  return Response.json(queries.list(limit), { headers: { "cache-control": "no-store" } });
}

function parseLimit(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= 1 && limit <= MAX_DASHBOARD_TRANSACTIONS ? limit : undefined;
}
