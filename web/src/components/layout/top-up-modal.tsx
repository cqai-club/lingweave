import { useEffect, useState } from "react";
import { Alert, Button, Divider, InputNumber, Modal, Radio, Segmented, Spin, Tag } from "antd";
import { ArrowUpRight, CheckCircle2, CreditCard, RefreshCw, Sparkles, WalletCards } from "lucide-react";
import type { AccountSummary } from "@cqaiclub/account-client";

import { createTopUp, getTopUpInfo } from "@/services/api/account";
import { formatAccountQuota, getAccountDisplayQuota } from "@/lib/account-quota";
import { buildTopUpRequest, getTopUpCreditAmount, normalizeTopUpInfo, submitTopUpPayment, type TopUpInfo } from "@/lib/top-up";

type TopUpModalProps = {
    open: boolean;
    account: AccountSummary | null;
    onClose: () => void;
    onRefreshAccount: () => Promise<void>;
};

type PaymentResult = {
    url?: string;
    fields?: Record<string, string>;
    orderId?: string;
};

export function TopUpModal({ open, account, onClose, onRefreshAccount }: TopUpModalProps) {
    const [info, setInfo] = useState<TopUpInfo | null>(null);
    const [optionId, setOptionId] = useState<string>();
    const [amount, setAmount] = useState<number | null>(null);
    const [choiceId, setChoiceId] = useState("");
    const [productId, setProductId] = useState("");
    const [payment, setPayment] = useState<PaymentResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setLoading(true);
        setError("");
        setPayment(null);
        void getTopUpInfo(controller.signal)
            .then((value) => setInfo(normalizeTopUpInfo(value)))
            .catch((reason) => {
                if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "读取充值配置失败");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [open]);

    useEffect(() => {
        if (!info) return;
        const nextOption = optionId && info.paymentOptions.some((item) => item.id === optionId) ? info.paymentOptions.find((item) => item.id === optionId) : info.paymentOptions[0];
        if (!nextOption) return;
        setOptionId(nextOption.id);
        setChoiceId((current) => (nextOption.choices.some((item) => item.id === current) ? current : nextOption.choices[0]?.id || ""));
        setProductId((current) => (nextOption.products.some((item) => item.id === current) ? current : nextOption.products[0]?.id || ""));
        setAmount((current) => current ?? info.amountOptions[0] ?? info.minTopUp ?? 10);
    }, [info, optionId]);

    const availableAmounts = info?.amountOptions ?? [];
    const currentBalance = account ? getAccountDisplayQuota(account) : undefined;
    const selectedOption = info?.paymentOptions.find((item) => item.id === optionId) ?? info?.paymentOptions[0];

    function selectOption(next: string) {
        setOptionId(next);
        setPayment(null);
        setError("");
    }

    async function submit() {
        if (!selectedOption) return;
        if (selectedOption.kind === "product" && !productId) return setError("请选择充值产品");
        if (selectedOption.kind === "amount" && (!amount || amount <= 0)) return setError("请输入有效的充值数量");
        setSubmitting(true);
        setError("");
        const paymentTarget = `cqai-payment-${Date.now()}`;
        const paymentWindow = typeof window === "undefined" ? null : window.open("about:blank", paymentTarget);
        try {
            const response = await createTopUp(
                buildTopUpRequest(selectedOption.id, {
                    ...(selectedOption.kind === "amount" ? { amount: amount || 0 } : {}),
                    productId,
                    choiceId,
                }),
            );
            const data = isRecord(response.data) ? response.data : {};
            const url = safeUrl(response.url || readString(data.payment_url ?? data.checkout_url ?? data.pay_link ?? data.url));
            const fields = isRecord(data.payment_fields) ? primitiveFields(data.payment_fields) : response.url && url ? primitiveFields(data) : undefined;
            const orderId = readString(data.order_id ?? data.orderId ?? data.trade_no ?? data.out_trade_no);
            const nextPayment = { ...(url ? { url } : {}), ...(fields && Object.keys(fields).length > 0 ? { fields } : {}), ...(orderId ? { orderId } : {}) };
            setPayment(nextPayment);
            if (url) {
                if (!submitTopUpPayment(url, nextPayment.fields, paymentWindow, paymentTarget)) paymentWindow?.close();
            } else {
                paymentWindow?.close();
            }
        } catch (reason) {
            paymentWindow?.close();
            setError(reason instanceof Error ? reason.message : "创建充值订单失败");
        } finally {
            setSubmitting(false);
        }
    }

    async function refreshBalance() {
        setRefreshing(true);
        try {
            await onRefreshAccount();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "刷新余额失败");
        } finally {
            setRefreshing(false);
        }
    }

    return (
        <Modal open={open} onCancel={onClose} footer={null} width={560} centered destroyOnHidden styles={{ body: { padding: 0 } }}>
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-stone-950">
                <div className="relative overflow-hidden bg-stone-950 px-6 pb-6 pt-7 text-white dark:bg-black">
                    <div className="absolute -right-12 -top-16 size-44 rounded-full bg-amber-400/20 blur-3xl" />
                    <div className="relative flex items-start justify-between gap-4">
                        <div>
                            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300">
                                <Sparkles className="size-3.5" />
                                CQ AI Club Wallet
                            </div>
                            <h2 className="m-0 text-2xl font-semibold tracking-tight">账户充值</h2>
                            <p className="mb-0 mt-2 text-sm text-stone-300">充值入账到账号钱包，支付完成后可在此刷新余额。</p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-right backdrop-blur">
                            <div className="text-[11px] text-stone-400">当前可用</div>
                            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                                <WalletCards className="size-3.5" />
                                {account && currentBalance !== undefined ? formatAccountQuota(account, currentBalance) : "读取中"}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-5 px-6 py-6">
                    {error ? <Alert type="error" showIcon message={error} /> : null}
                    {loading ? (
                        <div className="flex min-h-44 items-center justify-center">
                            <Spin tip="读取充值配置..." />
                        </div>
                    ) : payment ? (
                        <PaymentCreated payment={payment} onRefresh={refreshBalance} refreshing={refreshing} onBack={() => setPayment(null)} />
                    ) : info && info.paymentOptions.length > 0 && selectedOption ? (
                        <>
                            <section>
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">选择支付方式</div>
                                    <Tag color="gold">安全支付</Tag>
                                </div>
                                <Segmented block value={selectedOption.id} options={info.paymentOptions.map((item) => ({ label: item.name, value: item.id }))} onChange={(value) => selectOption(String(value))} />
                            </section>

                            {selectedOption.choices.length > 0 ? (
                                <section>
                                    <div className="mb-2 text-sm font-semibold text-stone-900 dark:text-stone-100">支付渠道</div>
                                    <Radio.Group value={choiceId} onChange={(event) => setChoiceId(event.target.value)} className="flex flex-wrap gap-2">
                                        {selectedOption.choices.map((item) => (
                                            <Radio.Button key={item.id} value={item.id}>
                                                {item.name}
                                            </Radio.Button>
                                        ))}
                                    </Radio.Group>
                                </section>
                            ) : null}

                            {selectedOption.kind === "product" ? (
                                <section>
                                    <div className="mb-2 text-sm font-semibold text-stone-900 dark:text-stone-100">选择充值产品</div>
                                    <Radio.Group value={productId} onChange={(event) => setProductId(event.target.value)} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {selectedOption.products.map((item) => (
                                            <Radio.Button key={item.id} value={item.id} className="!h-auto !whitespace-normal !rounded-xl !px-3 !py-3">
                                                <span className="flex items-center justify-between gap-2">
                                                    <span>{item.name}</span>
                                                    <strong>
                                                        {item.price} {item.currency}
                                                    </strong>
                                                </span>
                                                <span className="mt-1 block text-xs text-stone-500">到账 {item.quota.toLocaleString("zh-CN")} 额度</span>
                                            </Radio.Button>
                                        ))}
                                    </Radio.Group>
                                </section>
                            ) : (
                                <section>
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">选择充值档位</div>
                                        <span className="text-xs text-stone-500">以服务端配置为准</span>
                                    </div>
                                    {availableAmounts.length > 0 ? (
                                        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {availableAmounts.map((item) => (
                                                <Button
                                                    key={item}
                                                    type={amount === item ? "primary" : "default"}
                                                    onClick={() => setAmount(item)}
                                                    className="!flex !h-auto !min-h-20 !w-full !flex-col !items-start !justify-start !rounded-xl !px-4 !py-3 !text-left"
                                                >
                                                    <span className="text-lg font-semibold leading-6">{formatTopUpAmount(getTopUpCreditAmount(account, item))}</span>
                                                    <span className="mt-1 text-xs font-normal opacity-70">应付金额 {formatTopUpAmount(item)}</span>
                                                </Button>
                                            ))}
                                        </div>
                                    ) : null}
                                    <InputNumber value={amount} onChange={setAmount} min={selectedOption.minTopUp || info.minTopUp || 1} precision={0} controls={false} addonAfter="充值金额" className="!w-full" />
                                    {amount && amount > 0 ? <TopUpAmountSummary account={account} amount={amount} /> : null}
                                </section>
                            )}

                            <Divider className="!my-0" />
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 text-xs leading-5 text-stone-500">
                                    <CreditCard className="size-4 shrink-0" />
                                    支付完成后将返回当前应用，并以订单回调结果确认到账
                                </div>
                                <Button type="primary" size="large" loading={submitting} onClick={() => void submit()} className="shrink-0">
                                    创建支付订单
                                </Button>
                            </div>
                        </>
                    ) : (
                        <Alert type="warning" showIcon message="当前暂无可用充值渠道" description="请联系管理员检查支付配置和合规开关。" />
                    )}
                </div>
            </div>
        </Modal>
    );
}

function TopUpAmountSummary({ account, amount }: { account: AccountSummary | null; amount: number }) {
    return (
        <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 dark:border-stone-800 dark:bg-stone-900">
                <div className="text-xs text-stone-500">到账积分</div>
                <div className="mt-1 text-base font-semibold text-stone-900 dark:text-stone-100">{formatTopUpAmount(getTopUpCreditAmount(account, amount))}</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 dark:border-stone-800 dark:bg-stone-900">
                <div className="text-xs text-stone-500">应付金额</div>
                <div className="mt-1 text-base font-semibold text-stone-900 dark:text-stone-100">{formatTopUpAmount(amount)}</div>
            </div>
        </div>
    );
}

function formatTopUpAmount(value: number) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value);
}

function PaymentCreated({ payment, onRefresh, refreshing, onBack }: { payment: PaymentResult; onRefresh: () => Promise<void>; refreshing: boolean; onBack: () => void }) {
    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="size-5" />
                    支付订单已创建
                </div>
                <p className="mb-0 mt-2 text-sm leading-6 text-emerald-700/80 dark:text-emerald-300/80">支付平台回调成功后才会入账。完成支付后回到这里刷新余额。</p>
                {payment.orderId ? <div className="mt-2 text-xs text-emerald-700/70 dark:text-emerald-300/70">订单号：{payment.orderId}</div> : null}
            </div>
            {payment.url ? (
                payment.fields ? (
                    <form action={payment.url} method="post" target="_blank" className="rounded-xl border border-stone-200 p-4 dark:border-stone-800">
                        <p className="mb-3 text-sm text-stone-600 dark:text-stone-300">支付页面已自动打开；如果浏览器拦截了弹窗，可点击下方按钮重新打开。</p>
                        {Object.entries(payment.fields).map(([key, value]) => (
                            <input key={key} type="hidden" name={key} value={value} />
                        ))}
                        <Button htmlType="submit" type="primary" block icon={<ArrowUpRight className="size-4" />}>
                            重新打开支付页面
                        </Button>
                    </form>
                ) : (
                    <Button href={payment.url} target="_blank" rel="noreferrer" type="primary" block icon={<ArrowUpRight className="size-4" />}>
                        打开支付页面
                    </Button>
                )
            ) : (
                <Alert type="info" showIcon message="订单已创建，但服务端没有返回支付链接" />
            )}
            <div className="flex gap-2">
                <Button className="flex-1" onClick={onBack}>
                    重新选择
                </Button>
                <Button className="flex-1" loading={refreshing} icon={<RefreshCw className="size-4" />} onClick={() => void onRefresh()}>
                    我已完成支付，刷新余额
                </Button>
            </div>
        </div>
    );
}

function primitiveFields(value: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(value)
            .filter(([, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
            .map(([key, item]) => [key, String(item)]),
    );
}

function safeUrl(value: string) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
    } catch {
        return undefined;
    }
}

function readString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
