# شبیه‌ساز غیررسمی درگاه پرداخت Behpardakht

[English](README.md) | [فارسی](README.fa.md)

نسخهٔ `0.1.0`. Behpardakht Simulator ابزاری محلی برای توسعه و آزمون بخشی از جریان‌های درگاه پرداخت به‌پرداخت ملت است. این پروژه مستقل، غیررسمی و فقط برای محیط توسعه است؛ به‌پرداخت ملت آن را تأیید، راه‌اندازی یا پشتیبانی نمی‌کند. هیچ پرداخت، انتقال وجه یا پردازش بانکی واقعی در آن رخ نمی‌دهد.

رفتار پروتکلی فقط از سند ارائه‌شدهٔ *Mellat PGW Technical Document v1.39*، آذر ۱۴۰۴، گرفته شده است. PDF رسمی در این مخزن بازنشر نمی‌شود. برای منشأ مستندات، [یادداشت منبع](docs/protocol/SOURCE.md) را ببینید.

## معرفی پروژه

این شبیه‌ساز برای توسعه‌دهنده‌ای است که می‌خواهد برنامهٔ پذیرندهٔ خود را بدون اتصال به درگاه واقعی، با درخواست‌های SOAP و چرخهٔ پرداخت آزمایش کند. برنامهٔ پذیرنده به فرایند محلی شبیه‌ساز درخواست می‌فرستد، `RefId` می‌گیرد، آن را به StartPay محلی می‌فرستد، نتیجهٔ پرداخت ساختگی را انتخاب می‌کند، callback را دریافت می‌کند و سپس Verify و تسویه را آزمون می‌کند.

این ابزار جایگزین سامانهٔ واقعی نیست. رفتار محلی، سناریوهای قطعی و Faultهای آن نباید به‌عنوان رفتار قطعی ارائه‌دهنده برداشت شوند.

## قابلیت‌های نسخهٔ 0.1.0

مسیرهای محلی پشتیبانی‌شده:

- `bpPayRequest`
- مسیر عادی و امن `bpDynamicPayRequest`
- مسیر عادی و امن `bpCumulativeDynamicPayRequest`
- StartPay محلی با ارسال `RefId`
- صفحهٔ پرداخت ساختگی، بدون هرگونه ورودی کارت یا اطلاعات بانکی
- callback محلیِ محدودشده با allowlist
- `bpVerifyRequest`
- `bpSettleRequest`
- `bpVerifySettleRequest`
- `bpInquiryRequest` و `bpReversalRequest` فقط تا حد اعتبارسنجی شکل درخواست و هم‌بستگی داده‌ها

برای Inquiry و Reversal، سند v1.39 نگاشت نتیجهٔ اختصاصی عملیات را مشخص نمی‌کند. بنابراین درخواست محلی معتبر نیز به SOAP Fault محلی می‌رسد و هیچ کد نتیجهٔ ارائه‌دهنده، تغییر وضعیت یا برگشت وجهی ساخته نمی‌شود. `KNOWN_REVERSED` تنها یک سناریوی آزمون شبیه‌ساز است و اجرای موفق `bpReversalRequest` نیست.

## قابلیت‌های پشتیبانی‌نشده

موارد زیر در نسخهٔ فعلی وجود ندارند:

- Refund، Refund V2، Refund-to-PAN، Charge و جریان‌های پرداخت/واریز واقعی
- رفتار SettleTime، تسویهٔ خودکار، زمان‌سنج برگشت و تلاش مجدد callback
- PAN، شمارهٔ موبایل، رمزنگاری واقعی، کلیدهای واقعی، PIN، CVV2 و OTP
- پردازش بانکی، جابه‌جایی پول، واریز یا تأیید واقعی
- سازگاری دقیق WSDL یا wire با ارائه‌دهنده
- احراز هویت واقعی پذیرنده و اطلاعات تولیدی
- ماندگاری داده؛ همهٔ تراکنش‌ها، سناریوها و Faultهای منتظر در حافظهٔ همان فرایند هستند و با restart از بین می‌روند

محدودیت‌ها و موارد نامشخص در [UNCERTAINTIES.md](docs/protocol/UNCERTAINTIES.md) ثبت شده‌اند.

## الزامات اجرا

این مخزن در آماده‌سازی انتشار با Node.js `22.19.0` و npm `10.9.3` آزموده شده است. در `package.json` بازهٔ رسمی `engines` تعریف نشده؛ این اعداد، واقعیت آزمون‌اند نه ادعای حداقل نسخهٔ پشتیبانی‌شده.

## نصب

```bash
git clone https://github.com/alirezasaremi/behpardakht-simulator.git
cd behpardakht-simulator
npm ci
```

## تنظیمات محیطی

ساده‌ترین جریان محلی به هیچ متغیر محیطی نیاز ندارد. callback به‌صورت پیش‌فرض غیرفعال است. فایل `.env.example` را در صورت نیاز کپی کنید:

```bash
cp .env.example .env.local
```

برای تحویل callback به گیرنده‌ای که خودتان کنترل می‌کنید، فقط originهای دقیق HTTP(S) را تنظیم کنید:

```dotenv
SIMULATOR_CALLBACK_ALLOWED_ORIGINS=http://127.0.0.1:4010
```

این allowlist حساس به امنیت است. میزبان ناشناس، آدرس اینترنتی عمومی یا endpoint تولید را وارد نکنید. `localhost` و `127.0.0.1` دو origin متفاوت‌اند و هرکدام باید صریحاً allowlist شوند. جزئیات در [راهنمای توسعه](docs/DEVELOPMENT.md) است.

## اجرای برنامه

```bash
npm run dev
```

سپس [http://localhost:3000](http://localhost:3000) را باز کنید. داشبورد توسعه‌دهنده در [http://localhost:3000/local](http://localhost:3000/local) است.

## اولین آزمون پرداخت

چرخهٔ معمول:

```text
bpPayRequest
0,RefId
StartPay محلی
صفحهٔ پرداخت ساختگی
Sale
callback
bpVerifyRequest
bpSettleRequest
```

1. یک درخواست `bpPayRequest` ساختگی به `POST /api/soap` بفرستید و `RefId` را از نتیجهٔ `0,RefId` استخراج کنید. بزرگی/کوچکی حروف `RefId` مهم است.
2. همان `RefId` را با فرم `POST` به `/local/start-pay` بفرستید. این endpoint محلی شما را به صفحهٔ پرداخت ساختگی منتقل می‌کند.
3. نتیجهٔ موفق یا ناموفق ساختگی را انتخاب کنید. در موفقیت، Sale محلی ثبت می‌شود. callback فقط زمانی تحویل می‌شود که origin ذخیره‌شدهٔ `callBackUrl` دقیقاً در allowlist باشد.
4. در گیرندهٔ callback، `RefId` و `SaleOrderId` را با درخواست اصلی هم‌بسته کنید. سپس `bpVerifyRequest` را با `terminalId`، `SaleOrderId` و `SaleReferenceId` منطبق بفرستید.
5. پس از نتیجهٔ `0` برای Verify، `bpSettleRequest` بفرستید. `0` محلی فقط ثبت دریافت درخواست تسویه است، نه واریز واقعی.
6. `bpVerifySettleRequest` جایگزین ترکیبی مستند برای Verify و Settle است؛ پس از Sale موفق، تأیید و ثبت درخواست تسویه را در یک درخواست محلی انجام می‌دهد.

نمونهٔ فرم StartPay:

```html
<form action="http://localhost:3000/local/start-pay" method="post">
  <input type="hidden" name="RefId" value="local_example_refid">
  <button type="submit">بازکردن صفحهٔ پرداخت محلی</button>
</form>
```

## نمونهٔ SOAP

نمونهٔ زیر از profile سازگاری محلی شبیه‌ساز است، نه ادعای WSDL یا XML کاملاً سازگار با ارائه‌دهنده. مقادیر همگی ساختگی‌اند. این نمونه در اجرای محلی با `POST /api/soap` آزموده شده است.

```bash
curl --request POST http://localhost:3000/api/soap \
  --header 'content-type: text/xml; charset=utf-8' \
  --data-binary @- <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <bpPayRequest>
      <terminalId>9007199254740993</terminalId>
      <userName>local-merchant</userName>
      <userPassword>fake-local-password</userPassword>
      <orderId>9007199254740995</orderId>
      <amount>1000</amount>
      <localDate>20260101</localDate>
      <localTime>120000</localTime>
      <additionalData>local test order</additionalData>
      <callBackUrl>https://merchant.test/callback</callBackUrl>
      <payerId>0</payerId>
    </bpPayRequest>
  </soap:Body>
</soap:Envelope>
XML
```

پاسخ SOAP محلی، متن `0,<local RefId>` را در `bpPayRequestResult` دارد. برای مسیرهای Dynamic و Cumulative، wrapper نتیجه با نام عملیات همان مسیر بازمی‌گردد و شکل نتیجه مشابه است. [سازگاری SOAP محلی](docs/protocol/SOAP_COMPATIBILITY.md) حدود کامل این profile را توضیح می‌دهد.

## آزمون از داخل برنامه

داشبورد `/local` فقط برای مشاهدهٔ امن اطلاعات تشخیصی همان فرایند است:

- فهرست تراکنش‌ها را با `RefId`، `orderId` یا شناسه‌های Sale جست‌وجو و فیلتر کنید.
- روی `RefId` کلیک کنید تا چرخهٔ عمر، وضعیت callback و تاریخچهٔ رویدادها را ببینید.
- URL مقصد callback، بدنهٔ callback، رمزها و اطلاعات حساس عمداً در داشبورد نمایش داده نمی‌شوند.
- صفحهٔ پرداخت ساختگی فقط نتیجهٔ موفق یا انصراف را دارد؛ هیچ فیلد کارت ندارد.
- خواندن داشبورد هیچ SOAP، callback، رویداد، سناریو یا Faultی را اجرا یا مصرف نمی‌کند.

## آزمون سناریوها

کنترل سناریو در صفحهٔ جزئیات تراکنش است و فقط به `RefId` موجود اعمال می‌شود:

- `NORMAL`: سناریوی خاصی فعال نیست.
- `VERIFY_UNRESOLVED`: Verify به‌شکل قطعی حل‌نشده می‌ماند؛ شبیه‌ساز ResCode ارائه‌دهنده اختراع نمی‌کند.
- `KNOWN_REVERSED`: حالت برگشت شناخته‌شدهٔ محلی را برای آزمون مسیرهای Verify مرتبط ایجاد می‌کند؛ این درخواست `bpReversalRequest` نیست.

این مقادیر `SIMULATOR_SCENARIO` هستند، نه رفتار ادعایی به‌پرداخت. API محدود کنترل نیز در `/local/api/scenarios` قرار دارد. جزئیات در [سناریوها](docs/scenarios/README.md) است.

## آزمون خطاهای ارتباطی

در صفحهٔ جزئیات، برای `bpVerifyRequest`، `bpSettleRequest` و `bpVerifySettleRequest` یک Fault ارتباطی یک‌بارمصرف انتخاب کنید:

- `PRE_EXECUTION_HTTP_FAILURE`: پیش از اجرا، پاسخ HTTP شکست می‌خورد و وضعیت تراکنش تغییر نمی‌کند.
- `POST_EXECUTION_HTTP_FAILURE`: عملیات ابتدا ثبت می‌شود، سپس پذیرنده پاسخ HTTP شکست می‌بیند.
- `POST_EXECUTION_MALFORMED_SOAP`: عملیات ابتدا ثبت می‌شود، سپس SOAP معیوب به پذیرنده برمی‌گردد.
- `POST_EXECUTION_DELAY`: عملیات ابتدا ثبت می‌شود، سپس پاسخ عادی با تأخیر ثابت محلی برمی‌گردد.

این پروفایل‌ها برای آزمون تحمل خطا و مشاهدهٔ متفاوت پذیرنده از وضعیت ثبت‌شده‌اند. API محدود آن‌ها `/local/api/transport-faults` است. [راهنمای Faultهای ارتباطی](docs/scenarios/TRANSPORT_FAULTS.md) را ببینید.

## استفاده به‌عنوان سرویس مستقل

شبیه‌ساز را جدا از برنامهٔ پذیرنده اجرا کنید. برنامهٔ پذیرنده می‌تواند آن را همانند ارائه‌دهندهٔ خارجی در محیط توسعه هدف بگیرد:

1. فرایند شبیه‌ساز روی `http://localhost:3000` اجرا می‌شود.
2. برنامهٔ پذیرنده درخواست SOAP را به `POST http://localhost:3000/api/soap` می‌فرستد.
3. پس از `0,RefId`، برنامهٔ پذیرنده `RefId` را به `POST http://localhost:3000/local/start-pay` ارسال می‌کند.
4. کاربر آزمون، نتیجهٔ پرداخت ساختگی را در `/local/payment/[RefId]` انتخاب می‌کند.
5. شبیه‌ساز callback را فقط به origin محلی allowlist‌شدهٔ برنامهٔ پذیرنده می‌فرستد.
6. برنامهٔ پذیرنده Verify/Settle یا `bpVerifySettleRequest` را به همان `/api/soap` می‌فرستد.
7. توسعه‌دهنده وضعیت امن را در `http://localhost:3000/local` بررسی می‌کند.

مسیر StartPay و صفحهٔ پرداخت، قرارداد محلی شبیه‌ساز هستند؛ endpoint تولیدی به‌پرداخت یا جایگزین آن نیستند.

## امنیت

این ابزار فقط برای توسعه است. هرگز وارد، ارسال، ثبت، ذخیره یا commit نکنید:

- شمارهٔ واقعی کارت یا PAN
- PIN، CVV2، OTP یا رمز اینترنتی
- شمارهٔ موبایل یا اطلاعات بانکی واقعی
- نام کاربری/رمز واقعی پذیرنده
- کلید واقعی رمزنگاری یا دادهٔ تولید

صفحهٔ پرداخت ساختگی عمداً هیچ ورودی کارت یا بانکی ندارد. شبیه‌ساز مسیرهای حساس Pay را محدود می‌کند و callback را فقط به allowlist دقیق محلی می‌فرستد.

## تفاوت با سرویس واقعی

شبیه‌ساز profile سازگاری SOAP محلی دارد، نه سازگاری WSDL/wire دقیق ارائه‌دهنده. SOAP Faultها و سناریوهای قطعی آن مخصوص شبیه‌سازند. هیچ پرداخت، تسویه، واریز، برگشت وجه یا سپردهٔ واقعی وجود ندارد. برخی رفتارها مستقیم از سند v1.39، برخی مرزهای محافظه‌کارانهٔ محلی، و برخی صرفاً سناریوی آزمون‌اند؛ طبقه‌بندی هرکدام در مستندات انگلیسی فنی ثبت شده است.

## تست‌ها

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`test:e2e` به Chromium نیاز دارد. اگر نصب نیست:

```bash
npx playwright install chromium
```

## ساختار مستندات

مستندات فنی و نگه‌داری عمداً انگلیسی باقی مانده‌اند:

- [فهرست مستندات](docs/README.md)
- [معماری](docs/ARCHITECTURE.md)
- [منبع و قرارداد پروتکل](docs/protocol/SOURCE.md)
- [سازگاری SOAP](docs/protocol/SOAP_COMPATIBILITY.md)
- [Verify](docs/protocol/VERIFY.md)، [Settle](docs/protocol/SETTLE.md) و [VerifySettle](docs/protocol/VERIFY_SETTLE.md)
- [Callback](docs/protocol/CALLBACK.md)، [StartPay](docs/protocol/START_PAY.md)، [Inquiry](docs/protocol/INQUIRY.md) و [Reversal](docs/protocol/REVERSAL.md)
- [عدم‌قطعیت‌ها](docs/protocol/UNCERTAINTIES.md)، [سناریوها](docs/scenarios/README.md) و [Faultهای ارتباطی](docs/scenarios/TRANSPORT_FAULTS.md)
- [داشبورد](docs/DASHBOARD.md)، [تست](docs/TESTING.md)، [توسعه](docs/DEVELOPMENT.md) و [آمادگی انتشار](docs/RELEASE_READINESS.md)

## مجوز

کد شبیه‌ساز Behpardakht Simulator و مستندات همین مخزن تحت [MIT License](LICENSE) هستند. PDF رسمی به‌پرداخت در مخزن بازنشر نشده است. MIT هیچ حقی دربارهٔ مستندات، نشان‌های تجاری یا دیگر مواد متعلق به به‌پرداخت و اشخاص ثالث اعطا نمی‌کند.
