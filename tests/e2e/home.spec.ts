import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";

// Process-memory simulator state is intentionally shared: dashboard lifecycle flows run in order.
test.describe.configure({ mode: "serial" });

const testRunOrderPrefix = Date.now().toString();

function orderId(suffix: string): string {
  return `77${testRunOrderPrefix}${suffix}`;
}

let callbackServer: Server;
const callbacks: URLSearchParams[] = [];

test.beforeAll(async () => {
  callbackServer = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      callbacks.push(new URLSearchParams(Buffer.concat(chunks).toString("utf-8")));
      response.writeHead(204).end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    callbackServer.once("error", reject);
    callbackServer.listen(4011, "127.0.0.1", () => {
      callbackServer.off("error", reject);
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => callbackServer.close((error) => (error ? reject(error) : resolve())));
});

async function createSuccessfulSale(
  page: import("@playwright/test").Page,
  orderId: string,
  callbackUrl = "https://merchant.test/callback",
) {
  const pay = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml; charset=utf-8" },
    data: `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest><terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword><orderId>${orderId}</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime><additionalData>dashboard browser test</additionalData><callBackUrl>${callbackUrl}</callBackUrl><payerId>0</payerId></bpPayRequest></soap:Body></soap:Envelope>`,
  });
  const refId = /<bpPayRequestResult>0,([^<]+)<\/bpPayRequestResult>/.exec(await pay.text())?.[1];
  expect(refId).toBeTruthy();
  const startPay = await page.request.post("/local/start-pay", { form: { RefId: refId ?? "" }, maxRedirects: 0 });
  await page.goto(startPay.headers()["location"] ?? "/");
  await page.getByRole("button", { name: "شبیه‌سازی پرداخت موفق" }).click();
  const transactionResponse = await page.request.get("/local/api/transactions?limit=100");
  const list = await transactionResponse.json() as { transactions: Array<{ refId?: string; transactionId: string; orderId: string; saleOrderId?: string; saleReferenceId?: string }> };
  const transaction = list.transactions.find((candidate) => candidate.refId === refId);
  expect(transaction).toBeTruthy();
  return { refId: refId!, transaction: transaction! };
}

function verifyXml(saleOrderId: string, saleReferenceId: string) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpVerifyRequest><terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword><orderId>88800001</orderId><saleOrderId>${saleOrderId}</saleOrderId><saleReferenceId>${saleReferenceId}</saleReferenceId></bpVerifyRequest></soap:Body></soap:Envelope>`;
}

function settleXml(saleOrderId: string, saleReferenceId: string) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpSettleRequest><terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword><orderId>88800002</orderId><saleOrderId>${saleOrderId}</saleOrderId><saleReferenceId>${saleReferenceId}</saleReferenceId></bpSettleRequest></soap:Body></soap:Envelope>`;
}

function verifySettleXml(saleOrderId: string, saleReferenceId: string) {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpVerifySettleRequest><terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword><orderId>88800003</orderId><saleOrderId>${saleOrderId}</saleOrderId><saleReferenceId>${saleReferenceId}</saleReferenceId></bpVerifySettleRequest></soap:Body></soap:Envelope>`;
}

async function completeLocalPayment(page: import("@playwright/test").Page, refId: string) {
  const startPay = await page.request.post("/local/start-pay", { form: { RefId: refId }, maxRedirects: 0 });
  expect(startPay.status()).toBe(303);
  await page.goto(startPay.headers()["location"] ?? "/");
  await page.getByRole("button", { name: "شبیه‌سازی پرداخت موفق" }).click();
}

async function transactionForRefId(page: import("@playwright/test").Page, refId: string) {
  const response = await page.request.get("/local/api/transactions?limit=100");
  const list = await response.json() as { transactions: Array<{ refId?: string; transactionId: string; saleOrderId?: string; saleReferenceId?: string }> };
  const transaction = list.transactions.find((candidate) => candidate.refId === refId);
  expect(transaction).toBeTruthy();
  return transaction!;
}

test("shows local dashboard with local-only notice", async ({ page }) => {
  await page.goto("/local");
  await expect(page.getByRole("heading", { name: "شبیه‌ساز Behpardakht" })).toBeVisible();
  await expect(page.getByText(/ابزار توسعهٔ محلی و غیررسمی/)).toBeVisible();
  await expect(page.getByText(/bpCumulativeDynamicPayRequest/)).toBeVisible();
});

test("keeps dashboard RTL without narrow-page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/local");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("body")).toHaveCSS("font-family", /Estedad/);
  await expect.poll(() => page.locator("body").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test("shows simulator identity and credential warning", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toHaveText("شبیه‌ساز غیررسمی درگاه پرداخت Behpardakht");
  await expect(page.getByText(/هیچ پرداخت واقعی انجام نمی‌شود/)).toBeVisible();
  await expect(page.getByText(/هرگز شمارهٔ کارت/)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("runs local Pay to StartPay to fake successful outcome without credential inputs", async ({ page }) => {
  const pay = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml; charset=utf-8" },
    data: `<?xml version="1.0" encoding="UTF-8"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpPayRequest>
        <terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword>
        <orderId>${orderId("001")}</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime>
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
  await expect(page.getByText("فقط شبیه‌ساز محلی")).toBeVisible();
  await expect(page.getByText(/این صفحه Behpardakht یا شاپرک نیست/)).toBeVisible();
  await expect(page.locator("input")).toHaveCount(0);
  await page.getByRole("button", { name: "شبیه‌سازی پرداخت موفق" }).click();
  await expect(page.getByText("شبیه‌سازی پرداخت محلی کامل شد")).toBeVisible();
  await expect(page.getByText(/وضعیت Sale: موفق/)).toBeVisible();
  await expect(page.getByText(/ارسال callback: تحویل نشد \(DESTINATION_REJECTED\)/)).toBeVisible();
});

test("runs merchant HTTP Pay callback, Verify, Settle, and dashboard lifecycle", async ({ page }) => {
  const callbackCount = callbacks.length;
  const sale = await createSuccessfulSale(page, orderId("010"), "http://127.0.0.1:4011/callback");
  await expect.poll(() => callbacks.length).toBeGreaterThan(callbackCount);
  const callback = callbacks.at(callbackCount);

  expect(callback?.get("RefId")).toBe(sale.refId);
  expect(callback?.get("ResCode")).toBe("0");
  expect(callback?.get("SaleOrderId")).toBe(sale.transaction.saleOrderId);
  expect(callback?.get("SaleReferenceId")).toBe(sale.transaction.saleReferenceId);

  const verified = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml" },
    data: verifyXml(sale.transaction.saleOrderId!, sale.transaction.saleReferenceId!),
  });
  await expect(verified.text()).resolves.toContain("<bpVerifyRequestResult>0</bpVerifyRequestResult>");
  const settled = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml" },
    data: settleXml(sale.transaction.saleOrderId!, sale.transaction.saleReferenceId!),
  });
  await expect(settled.text()).resolves.toContain("<bpSettleRequestResult>0</bpSettleRequestResult>");

  const detail = await page.request.get(`/local/api/transactions/${encodeURIComponent(sale.transaction.transactionId)}`);
  await expect(detail.json()).resolves.toMatchObject({
    saleState: "SUCCEEDED",
    verificationState: "VERIFIED",
    settlementState: "REQUESTED",
    callback: { status: "SUCCEEDED", httpStatus: 204 },
  });
});

test("runs Dynamic Pay normal request and derived local VerifySettle journey", async ({ page }) => {
  const response = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml" },
    data: `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpDynamicPayRequest><terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword><orderId>${orderId("011")}</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime><additionalData>dynamic browser journey</additionalData><callBackUrl>https://merchant.test/callback</callBackUrl><payerId>0</payerId><subServiceId>7</subServiceId></bpDynamicPayRequest></soap:Body></soap:Envelope>`,
  });
  const refId = /<bpDynamicPayRequestResult>0,([^<]+)<\/bpDynamicPayRequestResult>/.exec(await response.text())?.[1];
  expect(refId).toBeTruthy();
  await completeLocalPayment(page, refId!);
  const transaction = await transactionForRefId(page, refId!);

  const result = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml" },
    data: verifySettleXml(transaction.saleOrderId!, transaction.saleReferenceId!),
  });
  await expect(result.text()).resolves.toContain("<bpVerifySettleRequestResult>0</bpVerifySettleRequestResult>");
});

test("runs Cumulative Dynamic Pay normal request and derived local Verify journey", async ({ page }) => {
  const response = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml" },
    data: `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><bpCumulativeDynamicPayRequest><terminalId>9007199254740993</terminalId><userName>local-merchant</userName><userPassword>fake-local-password</userPassword><orderId>${orderId("012")}</orderId><amount>1000</amount><localDate>20260101</localDate><localTime>120000</localTime><additionalData>account-one,1000,</additionalData><callBackUrl>https://merchant.test/callback</callBackUrl></bpCumulativeDynamicPayRequest></soap:Body></soap:Envelope>`,
  });
  const refId = /<bpCumulativeDynamicPayRequestResult>0,([^<]+)<\/bpCumulativeDynamicPayRequestResult>/.exec(await response.text())?.[1];
  expect(refId).toBeTruthy();
  await completeLocalPayment(page, refId!);
  const transaction = await transactionForRefId(page, refId!);

  const result = await page.request.post("/api/soap", {
    headers: { "content-type": "text/xml" },
    data: verifyXml(transaction.saleOrderId!, transaction.saleReferenceId!),
  });
  await expect(result.text()).resolves.toContain("<bpVerifyRequestResult>0</bpVerifyRequestResult>");
});

test("shows a local successful Sale on dashboard detail without sensitive callback data", async ({ page }) => {
  const sale = await createSuccessfulSale(page, orderId("101"));
  await page.goto("/local");
  await expect(page.getByRole("link", { name: sale.refId })).toBeVisible();
  await page.getByRole("link", { name: sale.refId }).click();
  await expect(page.getByRole("heading", { name: "چرخهٔ تراکنش" })).toBeVisible();
  await expect(page.getByText("شناسه‌های پروتکل")).toBeVisible();
  await expect(page.getByText("اطلاعات تشخیصی callback")).toBeVisible();
  await expect(page.getByText("SALE_SUCCEEDED")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: sale.refId })).toHaveCSS("direction", "ltr");
  await expect(page.locator("body")).not.toContainText("fake-local-password");
});

test("assigns, clears, then observes VERIFY_UNRESOLVED through real local SOAP", async ({ page }) => {
  const sale = await createSuccessfulSale(page, orderId("102"));
  await page.goto(`/local/transactions/${encodeURIComponent(sale.transaction.transactionId)}`);
  await page.getByLabel("سناریو").selectOption("VERIFY_UNRESOLVED");
  await page.getByRole("button", { name: "تخصیص سناریو" }).click();
  await expect(page.getByText("کنترل سناریو به‌روزرسانی شد.")).toBeVisible();
  const unresolved = await page.request.post("/api/soap", { headers: { "content-type": "text/xml" }, data: verifyXml(sale.transaction.saleOrderId!, sale.transaction.saleReferenceId!) });
  expect(unresolved.status()).toBe(409);
  await page.getByLabel("سناریو").selectOption("NORMAL");
  await page.getByRole("button", { name: "پاک‌کردن سناریو" }).click();
  await expect(page.getByText("کنترل سناریو به‌روزرسانی شد.")).toBeVisible();
  const verified = await page.request.post("/api/soap", { headers: { "content-type": "text/xml" }, data: verifyXml(sale.transaction.saleOrderId!, sale.transaction.saleReferenceId!) });
  await expect(verified.text()).resolves.toContain("<bpVerifyRequestResult>0</bpVerifyRequestResult>");
  await page.getByRole("button", { name: "تازه‌سازی" }).click();
  await expect(page.getByText("تأییدشده").first()).toBeVisible();
});

test("assigns post-execution Verify fault, observes merchant failure, then committed dashboard state", async ({ page }) => {
  const sale = await createSuccessfulSale(page, orderId("103"));
  await page.goto(`/local/transactions/${encodeURIComponent(sale.transaction.transactionId)}`);
  await page.getByLabel("پروفایل").selectOption("POST_EXECUTION_HTTP_FAILURE");
  await page.getByLabel("عملیات هدف").selectOption("bpVerifyRequest");
  await page.getByRole("button", { name: "تخصیص خطای یک‌بارمصرف" }).click();
  await expect(page.getByText("کنترل ارتباطی یک‌بارمصرف به‌روزرسانی شد.")).toBeVisible();
  const failed = await page.request.post("/api/soap", { headers: { "content-type": "text/xml" }, data: verifyXml(sale.transaction.saleOrderId!, sale.transaction.saleReferenceId!) });
  expect(failed.status()).toBe(503);
  await page.getByRole("button", { name: "تازه‌سازی" }).click();
  await expect(page.getByText("تأییدشده").first()).toBeVisible();
  await expect(page.getByText("موردی در انتظار نیست")).toBeVisible();
});
