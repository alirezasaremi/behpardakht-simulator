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
      return localError(404, "RefId ناشناخته است", "تراکنش Pay محلی برای RefId ارسال‌شده وجود ندارد.");
    }
    if (error instanceof StartPayInputError) {
      return localError(400, "درخواست StartPay محلی نامعتبر است", "فرم StartPay محلی معتبر نیست.");
    }
    return localError(500, "خطای StartPay محلی", "شبیه‌ساز نتوانست این درخواست را پردازش کند.");
  }
}

function localError(status: number, title: string, detail: string): Response {
  return new Response(`<!doctype html><html lang="fa" dir="rtl"><title>${title}</title><main><h1>${title}</h1><p>${detail}</p></main></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
