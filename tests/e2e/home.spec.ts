import { expect, test } from "@playwright/test";

// Process-memory simulator state is intentionally shared: dashboard lifecycle flows run in order.
test.describe.configure({ mode: "serial" });

async function createSuccessfulSale(page: import("@playwright/test").Page, orderId: string) {
  const pay = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml; charset=utf-8" },
    data: `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest><terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword><orderId>${orderId}</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime><additionalData>dashboard browser test</additionalData><callBackUrl>https://merchant.test/callback</callBackUrl><payerId>0</payerId></bpPayRequest></soap:Body></soap:Envelope>`,
  });
  const refId = /<bpPayRequestResult>0,([^<]+)<\/bpPayRequestResult>/.exec(await pay.text())?.[1];
  expect(refId).toBeTruthy();
  const startPay = await page.request.post("/local/start-pay", { form: { RefId: refId ?? "" }, maxRedirects: 0 });
  await page.goto(startPay.headers()["location"] ?? "/");
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  const transactionResponse = await page.request.get("/local/api/transactions?limit=100");
  const list = await transactionResponse.json() as { transactions: Array<{ refId?: string; transactionId: string; orderId: string; saleOrderId?: string; saleReferenceId?: string }> };
  const transaction = list.transactions.find((candidate) => candidate.refId === refId);
  expect(transaction).toBeTruthy();
  return { refId: refId!, transaction: transaction! };
}

function verifyXml(saleOrderId: string, saleReferenceId: string) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpVerifyRequest><terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword><orderId>88800001</orderId><saleOrderId>${saleOrderId}</saleOrderId><saleReferenceId>${saleReferenceId}</saleReferenceId></bpVerifyRequest></soap:Body></soap:Envelope>`;
}

test("shows empty local dashboard with local-only notice", async ({ page }) => {
  await page.goto("/local");
  await expect(page.getByRole("heading", { name: "Behpardakht Simulator" })).toBeVisible();
  await expect(page.getByText(/Unofficial local developer tool/i)).toBeVisible();
  await expect(page.getByText("bpCumulativeDynamicPayRequest (safe normal path)")).toBeVisible();
  await expect(page.getByText(/No local transactions match/i)).toBeVisible();
});

test("shows simulator identity and credential warning", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toHaveText("Unofficial Behpardakht Payment Gateway Simulator");
  await expect(page.getByText("No real payment occurs.")).toBeVisible();
  await expect(page.getByText(/Never enter real card/i)).toBeVisible();
});

test("runs local Pay to StartPay to fake successful outcome without credential inputs", async ({ page }) => {
  const pay = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml; charset=utf-8" },
    data: `<?xml version="1.0" encoding="UTF-8"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest>
        <terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword>
        <orderId>9007199254740995</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime>
        <additionalData>browser lifecycle</additionalData><callBackUrl>https://merchant.test/callback</callBackUrl><payerId>0</payerId>
      </bpPayRequest></soap:Body></soap:Envelope>`,
  });
  const payBody = await pay.text();
  const refId = /<bpPayRequestResult>0,([^<]+)<\/bpPayRequestResult>/.exec(payBody)?.[1];
  expect(refId).toBeTruthy();

  const startPay = await page.request.post("/local/start-pay", {
    form: { RefId: refId ?? "" },
    maxRedirects: 0,
  });
  expect(startPay.status()).toBe(303);
  const location = startPay.headers()["location"];
  expect(location).toBeTruthy();

  await page.goto(location ?? "/");
  await expect(page.getByText("LOCAL SIMULATOR ONLY")).toBeVisible();
  await expect(page.getByText(/Not Behpardakht. Not Shaparak. Not a real banking page/i)).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await page.getByRole("button", { name: "Simulate successful payment" }).click();
  await expect(page.getByText("Local payment simulation complete")).toBeVisible();
  await expect(page.getByText(/Sale state: SUCCEEDED/)).toBeVisible();
  await expect(page.getByText(/Callback dispatch: not delivered \(DESTINATION_REJECTED\)/)).toBeVisible();
});

test("shows a local successful Sale on dashboard detail without sensitive callback data", async ({ page }) => {
  const sale = await createSuccessfulSale(page, "880001001");
  await page.goto("/local");
  await expect(page.getByRole("link", { name: sale.refId })).toBeVisible();
  await page.getByRole("link", { name: sale.refId }).click();
  await expect(page.getByRole("heading", { name: "Transaction lifecycle" })).toBeVisible();
  await expect(page.getByText("Protocol identifiers")).toBeVisible();
  await expect(page.getByText("Callback diagnostics")).toBeVisible();
  await expect(page.getByText("SALE_SUCCEEDED")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("fake-local-password");
});

test("assigns, clears, then observes VERIFY_UNRESOLVED through real local SOAP", async ({ page }) => {
  const sale = await createSuccessfulSale(page, "880001002");
  await page.goto(`/local/transactions/${encodeURIComponent(sale.transaction.transactionId)}`);
  await page.getByLabel("Scenario").selectOption("VERIFY_UNRESOLVED");
  await page.getByRole("button", { name: "Assign scenario" }).click();
  await expect(page.getByText("Scenario control updated.")).toBeVisible();
  const unresolved = await page.request.post("/api/soap", { headers: { "content-type": "text/xml" }, data: verifyXml(sale.transaction.saleOrderId!, sale.transaction.saleReferenceId!) });
  expect(unresolved.status()).toBe(409);
  await page.getByLabel("Scenario").selectOption("NORMAL");
  await page.getByRole("button", { name: "Clear scenario" }).click();
  await expect(page.getByText("Scenario control updated.")).toBeVisible();
  const verified = await page.request.post("/api/soap", { headers: { "content-type": "text/xml" }, data: verifyXml(sale.transaction.saleOrderId!, sale.transaction.saleReferenceId!) });
  await expect(verified.text()).resolves.toContain("<bpVerifyRequestResult>0</bpVerifyRequestResult>");
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("VERIFIED").first()).toBeVisible();
});

test("assigns post-execution Verify fault, observes merchant failure, then committed dashboard state", async ({ page }) => {
  const sale = await createSuccessfulSale(page, "880001003");
  await page.goto(`/local/transactions/${encodeURIComponent(sale.transaction.transactionId)}`);
  await page.getByLabel("Profile").selectOption("POST_EXECUTION_HTTP_FAILURE");
  await page.getByLabel("Target operation").selectOption("bpVerifyRequest");
  await page.getByRole("button", { name: "Assign one-shot fault" }).click();
  await expect(page.getByText("One-shot transport control updated.")).toBeVisible();
  const failed = await page.request.post("/api/soap", { headers: { "content-type": "text/xml" }, data: verifyXml(sale.transaction.saleOrderId!, sale.transaction.saleReferenceId!) });
  expect(failed.status()).toBe(503);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("VERIFIED").first()).toBeVisible();
  await expect(page.getByText("None pending")).toBeVisible();
});
