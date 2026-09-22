import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardHome, TransactionDetail } from "./dashboard-client";

afterEach(() => vi.unstubAllGlobals());

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("dashboard presentation", () => {
  it("shows clear empty local transaction state and provenance labels", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      classification: "SIMULATOR_INTERNAL",
      summary: { transactionCount: 0, successfulSales: 0, verified: 0, settlementRequested: 0, knownReversed: 0, semanticScenarios: 0, pendingTransportFaults: 0 },
      transactions: [],
    })));
    render(<DashboardHome />);
    expect(await screen.findByText(/تراکنش محلی منطبق پیدا نشد/)).toBeInTheDocument();
    expect(screen.getByText("UNSPECIFIED")).toBeInTheDocument();
    expect(screen.getByText(/ابزار توسعهٔ محلی و غیررسمی/)).toBeInTheDocument();
    expect(screen.getByText(/bpCumulativeDynamicPayRequest/)).toBeInTheDocument();
  });

  it("shows safe detail labels and scenario/transport explanations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({
      transactionId: "txn_1", refId: "Case-RefId", paymentOperation: "DYNAMIC_PAY", terminalId: "9007199254740993", orderId: "2", amount: "1000",
      saleState: "PENDING", verificationState: "NOT_ATTEMPTED", settlementState: "NOT_REQUESTED", reversalState: "NOT_REVERSED", lifecycleState: "AWAITING_SALE",
      callback: { attempted: false, status: "NOT_ATTEMPTED", classification: "SIMULATOR_INTERNAL" }, scenario: "NORMAL", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", events: [],
    })));
    render(<TransactionDetail transactionId="txn_1" />);
    expect(await screen.findByText("شناسه‌های پروتکل")).toBeInTheDocument();
    expect(screen.getByText(/حساس به بزرگی\/کوچکی حروف/)).toBeInTheDocument();
    expect(screen.getByText("DYNAMIC_PAY")).toBeInTheDocument();
    expect(screen.getAllByText(/PRE_EXECUTION_HTTP_FAILURE/)).not.toHaveLength(0);
    expect(screen.getByText(/ResCode ارائه‌دهنده ساخته شود/)).toBeInTheDocument();
    expect(screen.getByText(/URL مقصد و بدنهٔ callback عمداً نمایش داده نمی‌شوند/)).toBeInTheDocument();
    expect(screen.getAllByLabelText("سناریو")[1]).toHaveAttribute("dir", "ltr");
  });
});
