import type { AccountSummary } from "@cqaiclub/account-client";

const DEFAULT_QUOTA_PER_UNIT = 500_000;
const DEFAULT_USD_EXCHANGE_RATE = 1;
const FALLBACK_DISPLAY_TYPE = "TOKENS";

export function getAccountDisplayQuota(account: AccountSummary): number | undefined {
    if (account.tokenUnlimitedQuota === true) return account.quota;
    if (account.tokenUnlimitedQuota === false && account.tokenQuota !== undefined) return account.tokenQuota;
    return account.quota;
}

export function formatAccountQuota(account: AccountSummary, quota: number): string {
    const quotaPerUnit = account.quotaPerUnit && account.quotaPerUnit > 0 ? account.quotaPerUnit : DEFAULT_QUOTA_PER_UNIT;
    const displayType = normalizeDisplayType(account.quotaDisplayType);
    if (displayType === "TOKENS") return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(quota);

    let exchangeRate = DEFAULT_USD_EXCHANGE_RATE;
    let symbol = "$";
    if (displayType === "CNY") {
        exchangeRate = account.usdExchangeRate || DEFAULT_USD_EXCHANGE_RATE;
        symbol = "¥";
    } else if (displayType === "CUSTOM") {
        exchangeRate = account.customCurrencyExchangeRate || DEFAULT_USD_EXCHANGE_RATE;
        symbol = account.customCurrencySymbol || "¤";
    }
    const amount = (quota / quotaPerUnit) * exchangeRate;
    return `${symbol}${new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

function normalizeDisplayType(value: string | undefined) {
    const displayType = value?.trim().toUpperCase();
    return displayType === "CNY" || displayType === "CUSTOM" || displayType === "USD" || displayType === "TOKENS" ? displayType : FALLBACK_DISPLAY_TYPE;
}
