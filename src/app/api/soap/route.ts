import { localSimulator } from "@/server/local-simulator";

export const runtime = "nodejs";

/** SIMULATOR_INTERNAL singleton local endpoint. No production Behpardakht host is used. */
export async function POST(request: Request): Promise<Response> {
  return localSimulator.soap.handle(request);
}
