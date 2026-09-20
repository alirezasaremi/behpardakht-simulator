import { expect, test } from "@playwright/test";

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
