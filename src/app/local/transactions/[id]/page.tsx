import { TransactionDetail } from "@/components/dashboard/dashboard-client";

export default async function LocalTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransactionDetail transactionId={id} />;
}
