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
    return localError(403, "اقدام پرداخت محلی رد شد", "origin فرم متعلق به این شبیه‌ساز محلی نیست.");
  }
  try {
    const outcome = await extractPaymentOutcome(request);
    await localSimulator.payments.complete(refId, outcome);
    return Response.redirect(new URL(`/local/payment/${encodeURIComponent(refId)}`, request.url), 303);
  } catch (error) {
    if (error instanceof PaymentApplicationError && error.code === "UNKNOWN_REF_ID") {
      return localError(404, "RefId ناشناخته است", "تراکنش Pay محلی برای این اقدام وجود ندارد.");
    }
    if (error instanceof TransactionDomainError) {
      return localError(409, "پرداخت قبلاً تکمیل شده است", "شبیه‌ساز محلی اقدام تکراری صفحهٔ پرداخت را نمی‌پذیرد.");
    }
    if (error instanceof StartPayInputError) {
      return localError(400, "اقدام پرداخت محلی نامعتبر است", "فرم پرداخت محلی معتبر نیست.");
    }
    return localError(500, "اقدام پرداخت محلی ناموفق بود", "شبیه‌ساز نتوانست این اقدام را کامل کند.");
  }
}

function localError(status: number, title: string, detail: string): Response {
  return new Response(`<!doctype html><html lang="fa" dir="rtl"><title>${title}</title><main><h1>${title}</h1><p>${detail}</p></main></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
