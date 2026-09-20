import { DashboardQueryService } from "@/server/dashboard";
import { localSimulator } from "@/server/local-simulator";

export const runtime = "nodejs";

const queries = new DashboardQueryService(localSimulator);

/** SIMULATOR_INTERNAL local dashboard detail read route. It never writes aggregate or control state. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  const transaction = queries.getById(id);
  if (transaction === undefined) {
    return Response.json({ error: "Unknown local transaction." }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  return Response.json(transaction, { headers: { "cache-control": "no-store" } });
}
