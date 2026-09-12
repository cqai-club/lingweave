import { useEffect, useState, type ReactNode } from "react";
import { Alert, Button, Spin } from "antd";
import { ArrowLeft, CheckCircle2, Clock3, RefreshCw, WalletCards, XCircle } from "lucide-react";
import { useLogto } from "@logto/react";
import { useNavigate } from "react-router-dom";

import { ACCOUNT_SERVICE_ENABLED } from "@/constant/logto";
import { formatAccountQuota, getAccountDisplayQuota } from "@/lib/account-quota";
import { getAccountSummary, listTopUps } from "@/services/api/account";
import type { AccountSummary } from "@cqaiclub/account-client";

type TopUpRecord = {
    id?: number | string;
    tradeNo?: string;
    amount?: number;
    status?: string;
};

const query = new URLSearchParams(window.location.search);
const requestedOrderId = firstQueryValue(["cqai_order_id", "order_id", "orderId", "trade_no", "out_trade_no", "reference_id", "referenceId", "request_id"]);
const returnedStatus = query.get("status") || "";

export default function BillingResultPage() {
    if (!ACCOUNT_SERVICE_ENABLED) return <ResultShell><Alert type="warning" showIcon message="当前部署未启用账号服务" /></ResultShell>;
    return <EnabledBillingResultPage />;
}

function EnabledBillingResultPage() {
    const { isAuthenticated } = useLogto();
    const navigate = useNavigate();
    const [account, setAccount] = useState<AccountSummary | null>(null);
    const [order, setOrder] = useState<TopUpRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    async function refresh() {
        setRefreshing(true);
        setError("");
        try {
            const [nextAccount, result] = await Promise.all([getAccountSummary(), listTopUps({ page: 1, pageSize: 10 })]);
            setAccount(nextAccount);
            setOrder(findOrder(readRecords(result)));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "读取充值结果失败");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        if (!ACCOUNT_SERVICE_ENABLED || !isAuthenticated) {
            setLoading(false);
            return;
        }
        let active = true;
        let timer: number | undefined;
        let attempt = 0;

        const poll = async () => {
            try {
                const [nextAccount, result] = await Promise.all([getAccountSummary(), listTopUps({ page: 1, pageSize: 10 })]);
                if (!active) return;
                const nextOrder = findOrder(readRecords(result));
                setError("");
                setAccount(nextAccount);
                setOrder(nextOrder);
                setLoading(false);
                if (nextOrder?.status === "success" || returnedStatus === "cancelled" || attempt >= 9) return;
            } catch (reason) {
                if (!active) return;
                setError(reason instanceof Error ? reason.message : "读取充值结果失败");
                setLoading(false);
                if (attempt >= 3) return;
            }
            attempt += 1;
            timer = window.setTimeout(() => void poll(), 3000);
        };

        void poll();
        return () => {
            active = false;
            if (timer !== undefined) window.clearTimeout(timer);
        };
    }, [isAuthenticated]);

    if (!isAuthenticated) return <ResultShell><Alert type="warning" showIcon message="请先登录后查看充值结果" /></ResultShell>;

    const state = order?.status === "success" ? "success" : order?.status === "failed" || order?.status === "expired" ? "failed" : returnedStatus === "cancelled" ? "cancelled" : "pending";
    const stateCopy = {
        success: { icon: <CheckCircle2 className="size-7" />, title: "充值已到账", description: "服务端已确认支付并完成钱包入账。", color: "emerald" },
        cancelled: { icon: <XCircle className="size-7" />, title: "支付未完成", description: "支付页面已取消或返回未完成，账户余额不会增加。", color: "amber" },
        failed: { icon: <XCircle className="size-7" />, title: "充值未完成", description: "订单没有完成入账，请重新发起充值或联系管理员。", color: "red" },
        pending: { icon: <Clock3 className="size-7" />, title: "正在确认支付结果", description: "支付平台回调可能需要一点时间，页面会自动刷新订单状态。", color: "amber" },
    }[state];

    return (
        <main className="min-h-full overflow-y-auto bg-background px-4 py-10 text-stone-900 dark:text-stone-100 sm:px-6">
            <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-stone-200 bg-card shadow-sm dark:border-stone-800">
                <div className="relative overflow-hidden bg-stone-950 px-6 pb-8 pt-8 text-white sm:px-8">
                    <div className="absolute -right-16 -top-20 size-56 rounded-full bg-amber-400/20 blur-3xl" />
                    <div className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
                        <WalletCards className="size-4" /> CQ AI Club Wallet
                    </div>
                    <h1 className="relative mt-5 text-3xl font-semibold tracking-tight">充值结果</h1>
                    <p className="relative mb-0 mt-2 text-sm text-stone-300">支付页面已经结束，最终状态以服务端订单回调为准。</p>
                </div>

                <div className="space-y-5 px-6 py-7 sm:px-8">
                    {error ? <Alert type="error" showIcon message={error} /> : null}
                    {loading ? (
                        <div className="flex min-h-40 items-center justify-center"><Spin tip="读取订单状态..." /></div>
                    ) : (
                        <>
                            <div className={`rounded-2xl border px-5 py-5 ${stateCopy.color === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300" : stateCopy.color === "red" ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"}`}>
                                <div className="flex items-center gap-3 font-semibold">{stateCopy.icon}<span>{stateCopy.title}</span></div>
                                <p className="mb-0 mt-3 text-sm leading-6 opacity-80">{stateCopy.description}</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <SummaryItem label="当前余额" value={account ? formatAccountQuota(account, getAccountDisplayQuota(account) ?? 0) : "暂不可用"} />
                                <SummaryItem label="订单状态" value={order ? displayTopUpStatus(order.status) : returnedStatus === "cancelled" ? "支付已取消，等待订单确认" : "等待订单回传"} />
                                <SummaryItem label="充值数量" value={order?.amount === undefined ? "—" : order.amount.toLocaleString("zh-CN")} />
                                <SummaryItem label="订单号" value={order?.tradeNo || requestedOrderId || "—"} />
                            </div>
                            <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-5 dark:border-stone-800">
                                <Button icon={<ArrowLeft className="size-4" />} onClick={() => navigate("/")}>返回 LingWeave</Button>
                                <Button type="primary" icon={<RefreshCw className="size-4" />} loading={refreshing} onClick={() => void refresh()}>刷新订单和余额</Button>
                            </div>
                        </>
                    )}
                </div>
            </section>
        </main>
    );
}

function ResultShell({ children }: { children: ReactNode }) {
    return <main className="grid min-h-full place-items-center bg-background px-6"><section className="w-full max-w-lg">{children}</section></main>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
    return <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-stone-800 dark:bg-stone-900"><div className="text-xs text-stone-500">{label}</div><div className="mt-1 truncate text-sm font-medium">{value}</div></div>;
}

function findOrder(records: TopUpRecord[]) {
    if (requestedOrderId) return records.find((item) => item.tradeNo === requestedOrderId || String(item.id ?? "") === requestedOrderId) || null;
    if (returnedStatus === "cancelled") return null;
    return records[0] || null;
}

function displayTopUpStatus(status?: string) {
    return { pending: "待支付", success: "已到账", failed: "失败", expired: "已过期" }[status || ""] || status || "未知";
}

function readRecords(value: unknown): TopUpRecord[] {
    const data = isRecord(value) && isRecord(value.data) ? value.data : value;
    const items = isRecord(data) ? data.items ?? data.list ?? data.records : data;
    return Array.isArray(items) ? items.filter(isRecord).map(normalizeRecord) : [];
}

function normalizeRecord(value: Record<string, unknown>): TopUpRecord {
    return {
        ...(value.id === undefined ? {} : { id: value.id as number | string }),
        ...(readString(value.trade_no ?? value.tradeNo) ? { tradeNo: readString(value.trade_no ?? value.tradeNo) } : {}),
        ...(readNumber(value.amount) === undefined ? {} : { amount: readNumber(value.amount) }),
        ...(readString(value.status) ? { status: readString(value.status) } : {}),
    };
}

function firstQueryValue(keys: string[]) {
    for (const key of keys) {
        const value = query.get(key)?.trim();
        if (value) return value;
    }
    return "";
}

function readString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
    return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
