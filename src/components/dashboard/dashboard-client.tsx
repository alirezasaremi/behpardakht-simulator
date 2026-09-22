"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Classification = "PROTOCOL" | "SIMULATOR_INTERNAL" | "SIMULATOR_SCENARIO" | "UNSPECIFIED";
type Scenario = "NORMAL" | "VERIFY_UNRESOLVED" | "KNOWN_REVERSED";
type Profile = "NORMAL" | "PRE_EXECUTION_HTTP_FAILURE" | "POST_EXECUTION_HTTP_FAILURE" | "POST_EXECUTION_MALFORMED_SOAP" | "POST_EXECUTION_DELAY";
type Operation = "bpVerifyRequest" | "bpSettleRequest" | "bpVerifySettleRequest";
type Callback = { attempted: boolean; status: "NOT_ATTEMPTED" | "SUCCEEDED" | "FAILED"; attemptedAt?: string; completedAt?: string; failureCategory?: string; httpStatus?: number; classification: "SIMULATOR_INTERNAL" };
type PendingFault = { profile: Exclude<Profile, "NORMAL">; operation: Operation; consumption: "ONE_SHOT"; classification: "SIMULATOR_SCENARIO" };
type Transaction = {
  transactionId: string; refId?: string; paymentOperation: "PAY" | "DYNAMIC_PAY" | "CUMULATIVE_DYNAMIC_PAY"; terminalId: string; orderId: string; saleOrderId?: string; saleReferenceId?: string; amount: string;
  saleState: string; verificationState: string; settlementState: string; reversalState: string; lifecycleState: string;
  callback: Callback; scenario: Scenario; pendingTransportFault?: PendingFault; createdAt: string; updatedAt: string;
};
type Event = { eventId: string; at: string; type: string; classification: Classification; metadata: Record<string, string | number> };
type Detail = Transaction & { saleResCode?: string; saleCompletedAt?: string; verificationAttemptedAt?: string; verifiedAt?: string; settlementRequestedAt?: string; reversedAt?: string; events: Event[] };
type Summary = { transactionCount: number; successfulSales: number; verified: number; settlementRequested: number; knownReversed: number; semanticScenarios: number; pendingTransportFaults: number };
type ListResponse = { classification: "SIMULATOR_INTERNAL"; summary: Summary; transactions: Transaction[] };

const scenarios: readonly Scenario[] = ["NORMAL", "VERIFY_UNRESOLVED", "KNOWN_REVERSED"];
const profiles: readonly Profile[] = ["NORMAL", "PRE_EXECUTION_HTTP_FAILURE", "POST_EXECUTION_HTTP_FAILURE", "POST_EXECUTION_MALFORMED_SOAP", "POST_EXECUTION_DELAY"];
const operations: readonly Operation[] = ["bpVerifyRequest", "bpSettleRequest", "bpVerifySettleRequest"];

export function DashboardHome() {
  const [data, setData] = useState<ListResponse>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saleFilter, setSaleFilter] = useState("ALL");
  const [verificationFilter, setVerificationFilter] = useState("ALL");
  const [scenarioFilter, setScenarioFilter] = useState("ALL");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/local/api/transactions?limit=100", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json() as ListResponse);
    } catch {
      setError("دریافت اطلاعات شبیه‌ساز محلی ممکن نشد. سرور محلی را بررسی و دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const transactions = useMemo(() => (data?.transactions ?? []).filter((transaction) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = needle.length === 0 || [transaction.refId, transaction.orderId, transaction.saleOrderId, transaction.saleReferenceId]
      .some((value) => value?.toLowerCase().includes(needle));
    return matchesSearch && (saleFilter === "ALL" || transaction.saleState === saleFilter)
      && (verificationFilter === "ALL" || transaction.verificationState === verificationFilter)
      && (scenarioFilter === "ALL" || transaction.scenario === scenarioFilter);
  }), [data, saleFilter, scenarioFilter, search, verificationFilter]);

  return <main className="dashboard-shell">
    <DashboardHeader onRefresh={() => void refresh()} loading={loading} />
    <section className="dashboard-notice" aria-label="هشدار شبیه‌ساز محلی"><strong>ابزار توسعهٔ محلی و غیررسمی.</strong> فقط اطلاعات تشخیصی در حافظه نگه‌داری می‌شود؛ پرداخت، عملیات بانکی یا مدیریت پذیرندهٔ واقعی وجود ندارد.</section>
    <section aria-labelledby="status-heading" className="space-y-3">
      <div className="section-heading"><div><p className="eyebrow">SIMULATOR_INTERNAL</p><h2 id="status-heading">وضعیت شبیه‌ساز</h2></div><StateBadge value="PROCESS_LOCAL / IN_MEMORY" tone="neutral" /></div>
      <div className="metric-grid">{metricCards(data?.summary).map(([label, value]) => <article className="metric-card" key={label}><span>{label}</span><strong>{value}</strong><small>اطلاعات محلی</small></article>)}</div>
    </section>
    <section className="dashboard-grid" aria-label="قابلیت‌های شبیه‌ساز">
      <InfoCard title="عملیات پروتکل محلی پشتیبانی‌شده" classification="PROTOCOL"><ul className="compact-list"><li>bpPayRequest</li><li>bpDynamicPayRequest (مسیر عادی امن)</li><li>bpCumulativeDynamicPayRequest (مسیر عادی امن)</li><li>bpVerifyRequest</li><li>bpSettleRequest</li><li>bpVerifySettleRequest</li><li>bpInquiryRequest</li><li>bpReversalRequest</li></ul></InfoCard>
      <InfoCard title="سناریوهای معنایی" classification="SIMULATOR_SCENARIO"><p><span dir="ltr">NORMAL</span>، <span dir="ltr">VERIFY_UNRESOLVED</span> و <span dir="ltr">KNOWN_REVERSED</span>؛ کنترل‌های محلی، محدود و وابسته به تراکنش.</p></InfoCard>
      <InfoCard title="خطاهای ارتباطی یک‌بارمصرف" classification="SIMULATOR_SCENARIO"><p>خطاهای پیش و پس از اجرا برای Verify، Settle و VerifySettle. این‌ها آزمون مشاهدهٔ پذیرنده‌اند، نه وضعیت پروتکل.</p></InfoCard>
    </section>
    <section aria-labelledby="transactions-heading" className="panel">
      <div className="section-heading"><div><p className="eyebrow">SIMULATOR_INTERNAL</p><h2 id="transactions-heading">تراکنش‌ها</h2><p>تراکنش‌های اخیرِ فرایند محلی. پس از فعالیت SOAP برنامهٔ پذیرنده، تازه‌سازی کنید.</p></div></div>
      <div className="filter-bar">
        <label>جست‌وجوی شناسه‌ها<input dir="ltr" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="RefId، orderId، Sale ID" /></label>
        <Filter label="وضعیت Sale" value={saleFilter} values={["ALL", "PENDING", "SUCCEEDED", "NON_SUCCESS"]} onChange={setSaleFilter} />
        <Filter label="وضعیت Verify" value={verificationFilter} values={["ALL", "NOT_ATTEMPTED", "ATTEMPTED", "VERIFIED"]} onChange={setVerificationFilter} />
        <Filter label="سناریو" value={scenarioFilter} values={["ALL", ...scenarios]} onChange={setScenarioFilter} />
      </div>
      {error ? <ErrorMessage message={error} /> : loading && data === undefined ? <p className="empty-state">اطلاعات محلی در حال بارگیری است…</p> : transactions.length === 0 ? <p className="empty-state">تراکنش محلی منطبق پیدا نشد. یک درخواست Pay محلی ساختگی بفرستید، سپس تازه‌سازی کنید.</p> : <TransactionTable transactions={transactions} />}
    </section>
    <ClassificationLegend />
  </main>;
}

export function TransactionDetail({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<Detail>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch(`/local/api/transactions/${encodeURIComponent(transactionId)}`, { cache: "no-store" });
      if (response.status === 404) throw new Error("تراکنش محلی دیگر وجود ندارد.");
      if (!response.ok) throw new Error("دریافت اطلاعات تراکنش ممکن نشد.");
      setData(await response.json() as Detail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "دریافت اطلاعات تراکنش ممکن نشد.");
    } finally {
      setLoading(false);
    }
  }, [transactionId]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  if (error) return <main className="dashboard-shell"><DashboardHeader onRefresh={() => void refresh()} loading={loading} /><ErrorMessage message={error} /><Link className="back-link" href="/local">بازگشت به داشبورد</Link></main>;
  if (data === undefined) return <main className="dashboard-shell"><DashboardHeader onRefresh={() => void refresh()} loading={loading} /><p className="empty-state">اطلاعات تراکنش در حال بارگیری است…</p></main>;
  return <main className="dashboard-shell">
    <DashboardHeader onRefresh={() => void refresh()} loading={loading} />
    <Link className="back-link" href="/local">همهٔ تراکنش‌ها</Link>
    <section className="detail-title"><div><p className="eyebrow">تراکنش محلی / SIMULATOR_INTERNAL</p><h1>چرخهٔ تراکنش</h1><code>{data.refId ?? "RefId تخصیص داده نشده است"}</code></div><StateBadge value={data.lifecycleState} tone={toneFor(data.lifecycleState)} /></section>
    <section className="dashboard-notice"><strong>فقط مشاهده و کنترل‌های محلی محدود.</strong> باز کردن این صفحه SOAP اجرا نمی‌کند، callback نمی‌فرستد، رویدادی نمی‌افزاید و سناریو یا خطای ارتباطی را مصرف نمی‌کند.</section>
    <section className="detail-grid">
      <InfoCard title="نمای کلی" classification="SIMULATOR_INTERNAL"><DefinitionList rows={[["مبلغ", data.amount], ["Sale", stateLabel(data.saleState)], ["تأیید", stateLabel(data.verificationState)], ["تسویه", stateLabel(data.settlementState)], ["برگشت", stateLabel(data.reversalState)], ["ایجاد", formatTime(data.createdAt)], ["آخرین فعالیت", formatTime(data.updatedAt)]]} /></InfoCard>
      <InfoCard title="شناسه‌های پروتکل" classification="PROTOCOL"><DefinitionList mono rows={[["عملیات درخواست", data.paymentOperation], ["terminalId", data.terminalId], ["orderId پرداخت", data.orderId], ["SaleOrderId", data.saleOrderId ?? "—"], ["SaleReferenceId", data.saleReferenceId ?? "—"], ["RefId (حساس به بزرگی/کوچکی حروف)", data.refId ?? "—"]]} /></InfoCard>
    </section>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">نمایش چرخهٔ عمر / SIMULATOR_INTERNAL</p><h2>چرخهٔ عمر</h2></div></div><Lifecycle transaction={data} /></section>
    <section className="detail-grid"><InfoCard title="اطلاعات تشخیصی callback" classification="SIMULATOR_INTERNAL"><CallbackPanel callback={data.callback} /></InfoCard><ScenarioControl transaction={data} onChanged={refresh} /><TransportControl transaction={data} onChanged={refresh} /></section>
    <section className="panel" aria-labelledby="events-heading"><div className="section-heading"><div><p className="eyebrow">نمایش امن فقط-افزودنی</p><h2 id="events-heading">تاریخچهٔ رویدادها</h2></div></div><EventHistory events={data.events} /></section>
    <ClassificationLegend />
  </main>;
}

function DashboardHeader({ onRefresh, loading }: { onRefresh: () => void; loading: boolean }) {
  return <header className="dashboard-header"><div><p className="eyebrow">غیررسمی / محلی / ابزار توسعه</p><h1>شبیه‌ساز Behpardakht</h1><p>اطلاعات تشخیصی امن تراکنش و کنترل‌های قطعی آزمون.</p></div><button className="button secondary" type="button" onClick={onRefresh} disabled={loading}>{loading ? "در حال تازه‌سازی…" : "تازه‌سازی"}</button></header>;
}

function metricCards(summary?: Summary): [string, number][] {
  return [["تراکنش‌ها", summary?.transactionCount ?? 0], ["Sale موفق", summary?.successfulSales ?? 0], ["تأییدشده", summary?.verified ?? 0], ["درخواست تسویه", summary?.settlementRequested ?? 0], ["برگشت شناخته‌شده", summary?.knownReversed ?? 0], ["سناریوهای معنایی", summary?.semanticScenarios ?? 0], ["خطاهای ارتباطی در انتظار", summary?.pendingTransportFaults ?? 0]];
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <label>{label}<select dir="ltr" value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
}

function InfoCard({ title, classification, children }: { title: string; classification: Classification; children: React.ReactNode }) {
  return <article className="info-card"><div className="card-title"><h2>{title}</h2><ClassificationBadge classification={classification} /></div>{children}</article>;
}

function StateBadge({ value, tone }: { value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  return <span className={`state-badge ${tone}`} title={value} aria-label={`${stateLabel(value)} (${value})`}>{stateLabel(value)}</span>;
}

function ClassificationBadge({ classification }: { classification: Classification }) {
  return <span className="classification-badge">{classification}</span>;
}

function TransactionTable({ transactions }: { transactions: readonly Transaction[] }) {
  return <div className="table-wrap"><table><thead><tr><th>RefId</th><th>عملیات / orderId</th><th>شناسه‌های Sale</th><th>مبلغ</th><th>وضعیت‌ها</th><th>وضعیت callback</th><th>سناریو / خطا</th><th>آخرین فعالیت</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.transactionId}><td><Link href={`/local/transactions/${encodeURIComponent(transaction.transactionId)}`} className="identifier">{transaction.refId ?? "—"}</Link></td><td className="identifier">{transaction.paymentOperation}<br />{transaction.orderId}</td><td className="identifier">{transaction.saleOrderId ?? "—"}<br />{transaction.saleReferenceId ?? ""}</td><td className="identifier">{transaction.amount}</td><td><StateBadge value={transaction.saleState} tone={toneFor(transaction.saleState)} /><StateBadge value={transaction.verificationState} tone={toneFor(transaction.verificationState)} /><StateBadge value={transaction.settlementState} tone={toneFor(transaction.settlementState)} /><StateBadge value={transaction.reversalState} tone={toneFor(transaction.reversalState)} /></td><td><StateBadge value={transaction.callback.status} tone={toneFor(transaction.callback.status)} /></td><td><StateBadge value={transaction.scenario} tone={toneFor(transaction.scenario)} />{transaction.pendingTransportFault && <span className="small-code">{transaction.pendingTransportFault.profile}<br />{transaction.pendingTransportFault.operation}</span>}</td><td><span className="identifier">{formatTime(transaction.updatedAt)}</span></td></tr>)}</tbody></table></div>;
}

function DefinitionList({ rows, mono = false }: { rows: readonly (readonly [string, string])[]; mono?: boolean }) {
  return <dl className="definition-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={mono ? "identifier" : undefined}>{value}</dd></div>)}</dl>;
}

function Lifecycle({ transaction }: { transaction: Detail }) {
  const stages = [["ایجاد Pay", true], ["Sale", transaction.saleState !== "PENDING"], ["Verify", transaction.verificationState !== "NOT_ATTEMPTED"], ["درخواست تسویه", transaction.settlementState === "REQUESTED"]] as const;
  return <div><ol className="lifecycle">{stages.map(([label, complete]) => <li key={label} className={complete ? "complete" : "pending"}><span>{complete ? "●" : "○"}</span><div><strong>{label}</strong><small>{lifecycleText(label, transaction)}</small></div></li>)}</ol>{transaction.reversalState === "REVERSED" && <p className="reversed-note"><StateBadge value="KNOWN_REVERSED" tone="bad" /> شبیه‌ساز وضعیت برگشت را می‌شناسد؛ این به‌معنای تکمیل <span dir="ltr">bpReversalRequest</span> نیست.</p>}</div>;
}

function lifecycleText(stage: string, transaction: Detail): string {
  if (stage === "Sale") return stateLabel(transaction.saleState);
  if (stage === "Verify") return stateLabel(transaction.verificationState);
  if (stage === "درخواست تسویه") return transaction.settlementState === "REQUESTED" ? stateLabel("REQUESTED") : "درخواستی ثبت نشده است";
  return formatTime(transaction.createdAt);
}

function CallbackPanel({ callback }: { callback: Callback }) {
  return <><p><StateBadge value={callback.status} tone={toneFor(callback.status)} /></p><DefinitionList mono rows={[["تلاش شده", callback.attempted ? "بله" : "خیر"], ["زمان تلاش", callback.attemptedAt ? formatTime(callback.attemptedAt) : "—"], ["زمان تکمیل", callback.completedAt ? formatTime(callback.completedAt) : "—"], ["دستهٔ خطا", callback.failureCategory ?? "—"], ["وضعیت HTTP", callback.httpStatus?.toString() ?? "—"]]} /><p className="subtle">URL مقصد و بدنهٔ callback عمداً نمایش داده نمی‌شوند.</p></>;
}

function ScenarioControl({ transaction, onChanged }: { transaction: Detail; onChanged: () => Promise<void> }) {
  const [scenario, setScenario] = useState<Scenario>(transaction.scenario);
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!transaction.refId) return setMessage("کنترل سناریو به RefId تخصیص‌داده‌شده نیاز دارد.");
    setSaving(true);
    setMessage(undefined);
    const response = await fetch("/local/api/scenarios", scenario === "NORMAL" ? { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ refId: transaction.refId }) } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refId: transaction.refId, scenario }) });
    if (!response.ok) setMessage("عملیات سناریو پذیرفته نشد.");
    else { setMessage("کنترل سناریو به‌روزرسانی شد."); await onChanged(); }
    setSaving(false);
  }
  return <InfoCard title="سناریوی معنایی" classification="SIMULATOR_SCENARIO"><p className="subtle">فعلی: <strong dir="ltr">{transaction.scenario}</strong></p><label className="control-label">سناریو<select dir="ltr" value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}>{scenarios.map((item) => <option key={item}>{item}</option>)}</select></label><button className="button" type="button" onClick={() => void submit()} disabled={saving}>{saving ? "در حال ذخیره…" : scenario === "NORMAL" ? "پاک‌کردن سناریو" : "تخصیص سناریو"}</button><p className="subtle"><span dir="ltr">VERIFY_UNRESOLVED</span> نتیجهٔ حل‌نشدهٔ قطعی برای Verify ایجاد می‌کند، بی‌آن‌که ResCode ارائه‌دهنده ساخته شود. <span dir="ltr">KNOWN_REVERSED</span> فقط وضعیت محلی مجاز را تحمیل می‌کند؛ این <span dir="ltr">bpReversalRequest</span> نیست.</p>{message && <ControlMessage message={message} />}</InfoCard>;
}

function TransportControl({ transaction, onChanged }: { transaction: Detail; onChanged: () => Promise<void> }) {
  const [profile, setProfile] = useState<Profile>(transaction.pendingTransportFault?.profile ?? "NORMAL");
  const [operation, setOperation] = useState<Operation>(transaction.pendingTransportFault?.operation ?? "bpVerifyRequest");
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!transaction.refId) return setMessage("کنترل خطای ارتباطی به RefId تخصیص‌داده‌شده نیاز دارد.");
    setSaving(true);
    setMessage(undefined);
    const response = await fetch("/local/api/transport-faults", profile === "NORMAL" ? { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ refId: transaction.refId }) } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refId: transaction.refId, profile, operation }) });
    if (!response.ok) setMessage("عملیات خطای ارتباطی پذیرفته نشد.");
    else { setMessage("کنترل ارتباطی یک‌بارمصرف به‌روزرسانی شد."); await onChanged(); }
    setSaving(false);
  }
  return <InfoCard title="خطای ارتباطی در انتظار" classification="SIMULATOR_SCENARIO"><p className="subtle">{transaction.pendingTransportFault ? <span dir="ltr">{transaction.pendingTransportFault.profile} / {transaction.pendingTransportFault.operation}</span> : "موردی در انتظار نیست"}</p><label className="control-label">پروفایل<select dir="ltr" value={profile} onChange={(event) => setProfile(event.target.value as Profile)}>{profiles.map((item) => <option key={item}>{item}</option>)}</select></label><label className="control-label">عملیات هدف<select dir="ltr" value={operation} onChange={(event) => setOperation(event.target.value as Operation)}>{operations.map((item) => <option key={item}>{item}</option>)}</select></label><button className="button" type="button" onClick={() => void submit()} disabled={saving}>{saving ? "در حال ذخیره…" : profile === "NORMAL" ? "پاک‌کردن خطا" : "تخصیص خطای یک‌بارمصرف"}</button><p className="subtle"><span dir="ltr">PRE_EXECUTION_HTTP_FAILURE</span> پیش از عملیات خطا می‌دهد و وضعیت را تغییر نمی‌دهد. پروفایل‌های <span dir="ltr">POST</span> ابتدا عملیات را ثبت می‌کنند و سپس مشاهدهٔ پذیرنده را تغییر می‌دهند. همه ثابت و فقط محلی‌اند.</p>{message && <ControlMessage message={message} />}</InfoCard>;
}

function EventHistory({ events }: { events: readonly Event[] }) {
  return <ol className="event-list">{events.map((event) => <li key={event.eventId}><div><strong dir="ltr">{event.type}</strong><span className="identifier">{formatTime(event.at)}</span></div><ClassificationBadge classification={event.classification} /><dl>{Object.entries(event.metadata).map(([key, value]) => <div key={key}><dt className="identifier">{key}</dt><dd className="identifier">{value}</dd></div>)}</dl></li>)}</ol>;
}

function ClassificationLegend() {
  return <section className="legend"><h2>طبقه‌بندی</h2><p><ClassificationBadge classification="PROTOCOL" /> رفتار مبتنی بر سند ارائه‌شدهٔ v1.39.</p><p><ClassificationBadge classification="SIMULATOR_INTERNAL" /> جزئیات پیاده‌سازی یا تشخیص محلی؛ هرگز ادعای رفتار ارائه‌دهنده نیست.</p><p><ClassificationBadge classification="SIMULATOR_SCENARIO" /> رفتار آزمون محلی، قطعی و کنترل‌شده توسط توسعه‌دهنده.</p><p><ClassificationBadge classification="UNSPECIFIED" /> v1.39 برای ادعای رفتار ارائه‌دهنده، اطلاعات کافی ندارد.</p></section>;
}

function ErrorMessage({ message }: { message: string }) { return <p className="error-message" role="alert">{message}</p>; }
function ControlMessage({ message }: { message: string }) { return <p className="control-message" role="status">{message}</p>; }
function formatTime(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleString("fa-IR"); }

function stateLabel(value: string): string {
  const labels: Record<string, string> = { ALL: "همه", "PROCESS_LOCAL / IN_MEMORY": "فرایند محلی / در حافظه", PROCESS_LOCAL: "فرایند محلی", IN_MEMORY: "در حافظه", PAY: "پرداخت", DYNAMIC_PAY: "پرداخت پویا", CUMULATIVE_DYNAMIC_PAY: "پرداخت پویای تجمیعی", PENDING: "در انتظار", SUCCEEDED: "موفق", NON_SUCCESS: "ناموفق", NOT_ATTEMPTED: "تلاش‌نشده", ATTEMPTED: "تلاش‌شده", VERIFIED: "تأییدشده", NOT_REQUESTED: "درخواست‌نشده", REQUESTED: "درخواست‌شده", NOT_REVERSED: "برگشت‌نشده", REVERSED: "برگشت‌خورده", AWAITING_SALE: "در انتظار Sale", VERIFY_PENDING: "در انتظار Verify", NORMAL: "عادی", VERIFY_UNRESOLVED: "Verify حل‌نشده", KNOWN_REVERSED: "برگشت شناخته‌شده", FAILED: "ناموفق" };
  return labels[value] ?? value.replaceAll("_", " ");
}

function toneFor(value: string): "good" | "warn" | "bad" | "neutral" {
  if (["SUCCEEDED", "VERIFIED", "REQUESTED", "NORMAL", "NOT_ATTEMPTED", "NOT_REVERSED"].includes(value)) return value === "NORMAL" || value.startsWith("NOT_") ? "neutral" : "good";
  if (["FAILED", "NON_SUCCESS", "REVERSED", "KNOWN_REVERSED"].includes(value)) return "bad";
  if (["ATTEMPTED", "VERIFY_UNRESOLVED", "PENDING", "AWAITING_SALE", "VERIFY_PENDING"].includes(value)) return "warn";
  return "neutral";
}
