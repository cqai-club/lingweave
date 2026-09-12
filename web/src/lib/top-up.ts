import type { CreateTopUpRequest } from "@cqaiclub/account-client";

type TopUpDisplayConfig = {
    quotaDisplayType?: string;
    quotaPerUnit?: number;
    usdExchangeRate?: number;
    customCurrencyExchangeRate?: number;
};

export type TopUpChoice = {
    id: string;
    name: string;
};

export type TopUpProduct = {
    id: string;
    name: string;
    price: number;
    currency: string;
    quota: number;
};

export type TopUpOption = {
    id: string;
    name: string;
    kind: "amount" | "product";
    minTopUp?: number;
    choices: TopUpChoice[];
    products: TopUpProduct[];
};

export type TopUpInfo = {
    paymentOptions: TopUpOption[];
    amountOptions: number[];
    minTopUp?: number;
};

export function normalizeTopUpInfo(value: unknown): TopUpInfo {
    const data = isRecord(value) && isRecord(value.data) ? value.data : value;
    if (!isRecord(data)) return emptyTopUpInfo();

    const paymentOptions = readRecords(data.payment_options ?? data.paymentOptions).flatMap((item) => {
        const id = readString(item.id);
        const name = readString(item.name);
        const kind = item.kind === "product" ? ("product" as const) : item.kind === "amount" ? ("amount" as const) : undefined;
        if (!id || !name || !kind) return [];
        const choices = readRecords(item.choices).flatMap((choice) => {
            const choiceId = readString(choice.id);
            const choiceName = readString(choice.name);
            return choiceId && choiceName ? [{ id: choiceId, name: choiceName }] : [];
        });
        const products = readRecords(item.products).flatMap((product) => {
            const productId = readString(product.id);
            const productName = readString(product.name);
            const price = readNumber(product.price);
            const currency = readString(product.currency);
            const quota = readNumber(product.quota);
            return productId && productName && price !== undefined && currency && quota !== undefined ? [{ id: productId, name: productName, price, currency, quota }] : [];
        });
        return [
            {
                id,
                name,
                kind,
                choices,
                products,
                ...(readNumber(item.min_top_up ?? item.minTopUp) === undefined ? {} : { minTopUp: readNumber(item.min_top_up ?? item.minTopUp) }),
            },
        ];
    });

    return {
        paymentOptions,
        amountOptions: readNumbers(data.amount_options ?? data.amountOptions),
        ...(readNumber(data.min_topup ?? data.minTopUp) === undefined ? {} : { minTopUp: readNumber(data.min_topup ?? data.minTopUp) }),
    };
}

export function buildTopUpRequest(paymentOptionId: string, options: { amount?: number; productId?: string; choiceId?: string } = {}): CreateTopUpRequest {
    return {
        payment_option_id: paymentOptionId,
        ...(options.amount === undefined ? {} : { amount: options.amount }),
        ...(options.productId ? { product_id: options.productId } : {}),
        ...(options.choiceId ? { choice_id: options.choiceId } : {}),
    };
}

export function getTopUpCreditAmount(account: TopUpDisplayConfig | null | undefined, amount: number) {
    const displayType = account?.quotaDisplayType?.trim().toUpperCase();
    if (displayType === "TOKENS") return amount;
    if (displayType === "CNY") return amount * positiveRate(account?.usdExchangeRate);
    if (displayType === "CUSTOM") return amount * positiveRate(account?.customCurrencyExchangeRate);
    return amount;
}

function positiveRate(value: number | undefined) {
    return value && value > 0 ? value : 1;
}

export function submitTopUpPayment(url: string, fields: Record<string, string> | undefined, paymentWindow: Window | null, target: string, ownerDocument: Document = document) {
    if (!paymentWindow || paymentWindow.closed) return false;
    if (fields && Object.keys(fields).length > 0) {
        const form = ownerDocument.createElement("form");
        form.action = url;
        form.method = "post";
        form.target = target;
        form.hidden = true;
        for (const [key, value] of Object.entries(fields)) {
            const input = ownerDocument.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = value;
            form.appendChild(input);
        }
        ownerDocument.body.appendChild(form);
        HTMLFormElement.prototype.submit.call(form);
        form.remove();
    } else {
        paymentWindow.location.href = url;
    }
    return true;
}

function emptyTopUpInfo(): TopUpInfo {
    return { paymentOptions: [], amountOptions: [] };
}

function readRecords(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readNumbers(value: unknown) {
    return Array.isArray(value) ? value.map(readNumber).filter((item): item is number => item !== undefined && item > 0) : [];
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
