import { localSimulator } from "@/server/local-simulator";
import { PaymentApplicationError } from "@/server/payment";
import { TransactionDomainError } from "@/server/transactions";
import { extractPaymentOutcome, hasTrustedLocalFormOrigin, StartPayInputError } from "@/server/start-pay";

export const runtime = "nodejs";

/** SIMULATOR_INTERNAL local mutation route. Stored transaction data always wins over browser values. */
export async function POST(
  request: Request,
  context: Readonly<{ params: Promise<{ refId: string }> }>,
): Promise<Response> {
  const { refId } = await context.params;
  if (!hasTrustedLocalFormOrigin(request)) {
    return localError(403, "Rejected local payment action", "Form origin is not this local simulator.");
  }
  try {
    const outcome = await extractPaymentOutcome(request);
    await localSimulator.payments.complete(refId, outcome);
    return Response.redirect(new URL(`/local/payment/${encodeURIComponent(refId)}`, request.url), 303);
  } catch (error) {
    if (error instanceof PaymentApplicationError && error.code === "UNKNOWN_REF_ID") {
      return localError(404, "Unknown RefId", "No local Pay transaction exists for this action.");
    }
    if (error instanceof TransactionDomainError) {
      return localError(409, "Payment already completed", "Local simulator rejects duplicate payment-page actions.");
    }
    if (error instanceof StartPayInputError) {
      return localError(400, "Invalid local payment action", error.message);
    }
    return localError(500, "Local payment action failed", "Simulator could not complete this action.");
  }
}

function localError(status: number, title: string, detail: string): Response {
  return new Response(`<!doctype html><title>${title}</title><main><h1>${title}</h1><p>${detail}</p></main>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
