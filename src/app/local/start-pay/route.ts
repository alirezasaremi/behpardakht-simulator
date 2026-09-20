import { localSimulator } from "@/server/local-simulator";
import { PaymentApplicationError } from "@/server/payment";
import { extractStartPayRefId, StartPayInputError } from "@/server/start-pay";

export const runtime = "nodejs";

/** SIMULATOR_INTERNAL local endpoint; it never uses a Behpardakht/Shaparak hostname. */
export async function POST(request: Request): Promise<Response> {
  try {
    const refId = await extractStartPayRefId(request);
    localSimulator.payments.findByRefId(refId);
    return Response.redirect(new URL(`/local/payment/${encodeURIComponent(refId)}`, request.url), 303);
  } catch (error) {
    if (error instanceof PaymentApplicationError && error.code === "UNKNOWN_REF_ID") {
      return localError(404, "Unknown RefId", "No local Pay transaction exists for submitted RefId.");
    }
    if (error instanceof StartPayInputError) {
      return localError(400, "Invalid local StartPay request", error.message);
    }
    return localError(500, "Local StartPay error", "Simulator could not process this request.");
  }
}

function localError(status: number, title: string, detail: string): Response {
  return new Response(`<!doctype html><title>${title}</title><main><h1>${title}</h1><p>${detail}</p></main>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
