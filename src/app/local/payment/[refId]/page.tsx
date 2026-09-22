import { displayCallbackDestination } from "@/server/callbacks";
import { localSimulator } from "@/server/local-simulator";
import type { Transaction, TransactionEvent } from "@/server/transactions";
import { notFound } from "next/navigation";

type PaymentPageProps = Readonly<{ params: Promise<{ refId: string }> }>;

export const dynamic = "force-dynamic";

/** SIMULATOR_INTERNAL developer page. It intentionally has no credential input. */
export default async function PaymentPage({ params }: PaymentPageProps) {
  const { refId } = await params;
  let transaction: Transaction;
  try {
    transaction = localSimulator.payments.findByRefId(refId);
  } catch {
    notFound();
  }
  const callbackEvent = transaction.events.at(-1);
  const completed = transaction.saleState !== "PENDING";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16 sm:px-10">
      <section className="w-full space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-wide text-amber-800">فقط شبیه‌ساز محلی</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">نتیجهٔ پرداخت شبیه‌سازی‌شده</h1>
          <p className="text-lg leading-8 text-zinc-700">
            این صفحه Behpardakht یا شاپرک نیست و صفحهٔ بانکی واقعی محسوب نمی‌شود. هیچ پرداخت واقعی انجام نمی‌شود.
          </p>
          <p className="rounded-md border border-red-200 bg-red-50 p-4 font-medium leading-7 text-red-900">
            هرگز شمارهٔ کارت، PAN، PIN، CVV2، تاریخ انقضا، OTP یا اطلاعات بانکی واقعی وارد نکنید.
          </p>
        </div>

        <dl className="grid gap-3 rounded-lg bg-zinc-50 p-5 text-sm sm:grid-cols-2">
          <div><dt className="font-medium text-zinc-600">RefId</dt><dd dir="ltr" className="break-all font-mono text-zinc-950">{transaction.refId}</dd></div>
          <div><dt className="font-medium text-zinc-600">orderId پرداخت</dt><dd dir="ltr" className="font-mono text-zinc-950">{transaction.orderId.toString()}</dd></div>
          <div><dt className="font-medium text-zinc-600">مبلغ</dt><dd dir="ltr" className="font-mono text-zinc-950">{transaction.amount.toString()}</dd></div>
          <div><dt className="font-medium text-zinc-600">وضعیت تراکنش</dt><dd title={transaction.lifecycleState} className="text-zinc-950">{paymentStateLabel(transaction.lifecycleState)}</dd></div>
          <div className="sm:col-span-2"><dt className="font-medium text-zinc-600">مقصد callback ذخیره‌شده</dt><dd dir="ltr" className="break-all font-mono text-zinc-950">{displayCallbackDestination(transaction.callBackUrl)}</dd></div>
        </dl>

        {completed ? (
          <section className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950" aria-live="polite">
            <h2 className="text-lg font-semibold">شبیه‌سازی پرداخت محلی کامل شد</h2>
            <p>وضعیت Sale: <span title={transaction.saleState}>{paymentStateLabel(transaction.saleState)}</span>. ارسال callback: {callbackMessage(callbackEvent)}.</p>
          </section>
        ) : (
          <form method="post" action={`/local/payment/${encodeURIComponent(refId)}/outcome`} className="flex flex-col gap-3 sm:flex-row">
            <button name="outcome" value="SUCCESS" type="submit" className="rounded-md bg-emerald-700 px-4 py-3 font-semibold text-white">
              شبیه‌سازی پرداخت موفق
            </button>
            <button name="outcome" value="NON_SUCCESS" type="submit" className="rounded-md border border-zinc-300 px-4 py-3 font-semibold text-zinc-900">
              شبیه‌سازی پرداخت ناموفق (انصراف)
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function callbackMessage(event: TransactionEvent | undefined): string {
  if (event?.type === "CALLBACK_DISPATCH_SUCCEEDED") {
    return `تحویل شد (HTTP ${event.httpStatus})`;
  }
  if (event?.type === "CALLBACK_DISPATCH_FAILED") {
    return event.httpStatus === undefined
      ? `تحویل نشد (${event.reason})`
      : `تحویل نشد (${event.reason}، HTTP ${event.httpStatus})`;
  }
  return "در انتظار";
}

function paymentStateLabel(value: string): string {
  return { AWAITING_SALE: "در انتظار Sale", SUCCEEDED: "موفق", NON_SUCCESS: "ناموفق", SALE_SUCCEEDED: "Sale موفق", SALE_NON_SUCCESS: "Sale ناموفق" }[value] ?? value;
}
