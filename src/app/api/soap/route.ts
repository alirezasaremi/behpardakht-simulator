import { createLocalSoapService } from "@/server/soap";

export const runtime = "nodejs";

/** SIMULATOR_INTERNAL singleton local endpoint. No production Behpardakht host is used. */
const service = createLocalSoapService();

export async function POST(request: Request): Promise<Response> {
  return service.handle(request);
}
