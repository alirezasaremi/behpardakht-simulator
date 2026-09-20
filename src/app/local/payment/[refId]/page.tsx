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
          <p className="text-sm font-semibold tracking-wide text-amber-800">LOCAL SIMULATOR ONLY</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Fake payment outcome</h1>
          <p className="text-lg leading-8 text-zinc-700">
            Not Behpardakht. Not Shaparak. Not a real banking page. No real payment occurs here.
          </p>
          <p className="rounded-md border border-red-200 bg-red-50 p-4 font-medium leading-7 text-red-900">
            Never enter card number, PAN, PIN, CVV2, expiry, OTP, or banking credentials.
          </p>
        </div>

        <dl className="grid gap-3 rounded-lg bg-zinc-50 p-5 text-sm sm:grid-cols-2">
          <div><dt className="font-medium text-zinc-600">RefId</dt><dd className="break-all font-mono text-zinc-950">{transaction.refId}</dd></div>
          <div><dt className="font-medium text-zinc-600">Pay orderId</dt><dd className="font-mono text-zinc-950">{transaction.orderId.toString()}</dd></div>
          <div><dt className="font-medium text-zinc-600">Amount</dt><dd className="font-mono text-zinc-950">{transaction.amount.toString()}</dd></div>
          <div><dt className="font-medium text-zinc-600">Transaction state</dt><dd className="font-mono text-zinc-950">{transaction.lifecycleState}</dd></div>
          <div className="sm:col-span-2"><dt className="font-medium text-zinc-600">Stored callback destination</dt><dd className="break-all font-mono text-zinc-950">{displayCallbackDestination(transaction.callBackUrl)}</dd></div>
        </dl>

        {completed ? (
          <section className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950" aria-live="polite">
            <h2 className="text-lg font-semibold">Local payment simulation complete</h2>
            <p>Sale state: {transaction.saleState}. Callback dispatch: {callbackMessage(callbackEvent)}.</p>
          </section>
        ) : (
          <form method="post" action={`/local/payment/${encodeURIComponent(refId)}/outcome`} className="flex flex-col gap-3 sm:flex-row">
            <button name="outcome" value="SUCCESS" type="submit" className="rounded-md bg-emerald-700 px-4 py-3 font-semibold text-white">
              Simulate successful payment
            </button>
            <button name="outcome" value="NON_SUCCESS" type="submit" className="rounded-md border border-zinc-300 px-4 py-3 font-semibold text-zinc-900">
              Simulate unsuccessful payment (cancellation)
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function callbackMessage(event: TransactionEvent | undefined): string {
  if (event?.type === "CALLBACK_DISPATCH_SUCCEEDED") {
    return `delivered (HTTP ${event.httpStatus})`;
  }
  if (event?.type === "CALLBACK_DISPATCH_FAILED") {
    return event.httpStatus === undefined
      ? `not delivered (${event.reason})`
      : `not delivered (${event.reason}, HTTP ${event.httpStatus})`;
  }
  return "pending";
}
