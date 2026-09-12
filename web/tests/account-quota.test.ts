import { describe, expect, it } from "vitest";

import { formatAccountQuota, getAccountDisplayQuota } from "@/lib/account-quota";

describe("账号余额展示", () => {
    it("有限额 Key 使用 Key 余额，即使余额为 0", () => {
        expect(getAccountDisplayQuota({ tokenUnlimitedQuota: false, tokenQuota: 0, quota: 13968614, userId: 6, platform: "lingweave" })).toBe(0);
    });

    it("无限额 Key 使用账号钱包余额", () => {
        expect(getAccountDisplayQuota({ tokenUnlimitedQuota: true, tokenQuota: 0, quota: 13968614, userId: 6, platform: "lingweave" })).toBe(13968614);
    });

    it("按 Relay 的额度配置换算人民币", () => {
        expect(formatAccountQuota({ quotaDisplayType: "CNY", quotaPerUnit: 500000, usdExchangeRate: 7, userId: 6, platform: "lingweave" }, 13968614)).toBe("¥195.56");
    });

    it("按 Relay 的自定义额度配置展示积分", () => {
        expect(formatAccountQuota({ quotaDisplayType: "CUSTOM", quotaPerUnit: 500000, customCurrencySymbol: "积分", customCurrencyExchangeRate: 10, userId: 6, platform: "lingweave" }, 13968614)).toBe("积分279.37");
    });

    it("按 Relay 的美元配置展示美元", () => {
        expect(formatAccountQuota({ quotaDisplayType: "USD", quotaPerUnit: 500000, userId: 6, platform: "lingweave" }, 13968614)).toBe("$27.94");
    });

    it("缺少展示配置时不臆造美元金额", () => {
        expect(formatAccountQuota({ userId: 6, platform: "lingweave" }, 13968614)).toBe("13,968,614");
    });
});
