export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-16 sm:px-10">
      <section className="space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium tracking-wide text-zinc-600">Local development tool</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Unofficial Behpardakht Payment Gateway Simulator
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-700">
          This project is a local/development simulator. No real payment occurs.
        </p>
        <p className="rounded-md border border-red-200 bg-red-50 p-4 font-medium leading-7 text-red-900">
          Never enter real card, PIN, CVV2, or OTP credentials here.
        </p>
      </section>
    </main>
  );
}
