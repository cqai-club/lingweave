import { describe, expect, it, vi } from "vitest";

import { buildTopUpRequest, getTopUpCreditAmount, normalizeTopUpInfo, submitTopUpPayment } from "@/lib/top-up";

describe("充值配置", () => {
    it("解析 Account Service 返回的支付渠道和档位", () => {
        const info = normalizeTopUpInfo({
            payment_options: [
                { id: "online-alipay", name: "支付宝", kind: "amount" },
                { id: "card", name: "Stripe", kind: "amount" },
            ],
            amount_options: [10, "20", 0],
        });
        expect(info.paymentOptions.map((item) => item.id)).toEqual(["online-alipay", "card"]);
        expect(info.amountOptions).toEqual([10, 20]);
        expect(info.paymentOptions[0]).toMatchObject({ name: "支付宝", kind: "amount" });
    });

    it("按 Account Service 的支付选项生成统一请求体", () => {
        expect(buildTopUpRequest("online-alipay", { amount: 20 })).toEqual({ payment_option_id: "online-alipay", amount: 20 });
        expect(buildTopUpRequest("card", { amount: 50 })).toEqual({ payment_option_id: "card", amount: 50 });
        expect(buildTopUpRequest("global", { amount: 100, choiceId: "1" })).toEqual({ payment_option_id: "global", amount: 100, choice_id: "1" });
        expect(buildTopUpRequest("package", { productId: "prod_1" })).toEqual({ payment_option_id: "package", product_id: "prod_1" });
    });

    it("不允许前端覆盖 Account Service 决定的回跳地址", () => {
        const request = buildTopUpRequest("card", { amount: 50 });
        expect(request).not.toHaveProperty("success_url");
        expect(request).not.toHaveProperty("cancel_url");
    });

    it("把 Account Service 返回的支付字段 POST 到预先打开的窗口", () => {
        let submittedForm: HTMLFormElement | undefined;
        const submitSpy = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (this: HTMLFormElement) {
            submittedForm = this;
        });
        const paymentWindow = { closed: false } as Window;

        expect(submitTopUpPayment("https://zpay.example/submit.php", { pid: "10001", out_trade_no: "trade-1", sign: "signature" }, paymentWindow, "cqai-payment-test")).toBe(true);
        expect(submittedForm?.method).toBe("post");
        expect(submittedForm?.target).toBe("cqai-payment-test");
        expect(
            Array.from(submittedForm?.elements ?? []).map((element) => {
                const input = element as HTMLInputElement;
                return [input.name, input.value];
            }),
        ).toEqual([
            ["pid", "10001"],
            ["out_trade_no", "trade-1"],
            ["sign", "signature"],
        ]);
        expect(submittedForm?.isConnected).toBe(false);
        submitSpy.mockRestore();
    });
});

describe("充值档位展示", () => {
    it("按自定义积分汇率展示到账积分，支付金额保持原档位", () => {
        expect(getTopUpCreditAmount({ quotaDisplayType: "CUSTOM", customCurrencyExchangeRate: 10 }, 10)).toBe(100);
    });

    it("按人民币汇率展示充值额度", () => {
        expect(getTopUpCreditAmount({ quotaDisplayType: "CNY", usdExchangeRate: 7 }, 10)).toBe(70);
    });

    it("积分模式直接展示服务端返回的积分数量", () => {
        expect(getTopUpCreditAmount({ quotaDisplayType: "TOKENS", quotaPerUnit: 500000 }, 500000)).toBe(500000);
    });
});
