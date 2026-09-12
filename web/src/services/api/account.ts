import { AccountClientError, CqaiAccountClient, type AccessTokenProvider, type AccountSummary, type BillingResponse, type CreateTopUpRequest } from "@cqaiclub/account-client";

import { ACCOUNT_SERVICE_ENABLED, ACCOUNT_SERVICE_URL } from "@/constant/logto";
import { buildApiUrl, type AiConfig } from "@/stores/use-config-store";

type AiRequestConfig = Pick<AiConfig, "apiKey" | "baseUrl" | "channelMode">;

let accessTokenProvider: AccessTokenProvider | undefined;
let accountClient: CqaiAccountClient | undefined;

export function setAccountAccessTokenProvider(provider: AccessTokenProvider) {
    accessTokenProvider = provider;
    return () => {
        if (accessTokenProvider === provider) accessTokenProvider = undefined;
    };
}

export function isAccountAiConfig(config: Pick<AiConfig, "channelMode">) {
    return ACCOUNT_SERVICE_ENABLED && config.channelMode === "remote";
}

export async function getAccountSummary(signal?: AbortSignal): Promise<AccountSummary> {
    return getAccountClient().getAccount(signal);
}

export async function getTopUpInfo(signal?: AbortSignal) {
    return getAccountClient().getTopUpInfo(signal);
}

export async function listTopUps(options: { page?: number; pageSize?: number; keyword?: string } = {}, signal?: AbortSignal) {
    return getAccountClient().listTopUps(options, signal);
}

export async function createTopUp(body: CreateTopUpRequest, signal?: AbortSignal): Promise<BillingResponse> {
    return getAccountClient().createTopUp(body, signal ? { signal } : {});
}

export async function requestAi(config: AiRequestConfig, path: string, init: RequestInit = {}) {
    if (isAccountAiConfig(config)) {
        try {
            return await getAccountClient().request(accountServicePath(path), init);
        } catch (error) {
            if (error instanceof AccountClientError && error.status === 401) throw new Error("请先登录 CQ AI Club");
            throw error;
        }
    }
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${config.apiKey}`);
    return fetch(buildApiUrl(config.baseUrl, path), { ...init, headers });
}

export async function requestAiJson<T>(config: AiRequestConfig, path: string, init: RequestInit = {}): Promise<T> {
    const response = await requestAi(config, path, init);
    const text = await response.text();
    const payload = parseJsonPayload(text, response.status);
    if (!response.ok || isBusinessFailure(payload)) throw new Error(responseErrorMessage(payload, `AI 请求失败（${response.status}）`));
    return payload as T;
}

export async function requestAiBlob(config: AiRequestConfig, path: string, init: RequestInit = {}) {
    const response = await requestAi(config, path, init);
    if (!response.ok) {
        const text = await response.text();
        const payload = parseOptionalJsonPayload(text);
        throw new Error(responseErrorMessage(payload, `AI 请求失败（${response.status}）`));
    }
    await assertAiResponse(response, "AI 请求失败");
    return response.blob();
}

export async function assertAiResponse(response: Response, fallback: string) {
    if (!response.ok) throw new Error(`${fallback}（${response.status}）`);
    if (response.headers.get("content-type")?.toLowerCase().includes("json")) {
        const payload = parseJsonPayload(await response.clone().text(), response.status);
        if (isBusinessFailure(payload)) throw new Error(responseErrorMessage(payload, `${fallback}（${response.status}）`));
    }
}

function getAccountClient() {
    if (!ACCOUNT_SERVICE_ENABLED) throw new Error("Account Service 尚未配置");
    accountClient ??= new CqaiAccountClient({
        baseUrl: ACCOUNT_SERVICE_URL,
        getAccessToken: async () => {
            if (!accessTokenProvider) throw new AccountClientError("Logto access token provider is unavailable", 401, "AUTH_TOKEN_REQUIRED");
            return accessTokenProvider();
        },
    });
    return accountClient;
}

function accountServicePath(path: string) {
    if (!path.startsWith("/") || path.startsWith("//")) throw new Error("AI API 路径无效");
    return path === "/v1" || path.startsWith("/v1/") ? path : `/v1${path}`;
}

function parseJsonPayload(text: string, status: number): unknown {
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`AI 服务返回了非 JSON 响应（${status}）`);
    }
}

function parseOptionalJsonPayload(text: string): unknown {
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function isBusinessFailure(payload: unknown) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const data = payload as { success?: unknown; code?: unknown };
    return data.success === false || data.code === false;
}

function responseErrorMessage(payload: unknown, fallback: string) {
    if (typeof payload === "string") return payload.trim() || fallback;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
    const data = payload as { message?: unknown; msg?: unknown; error?: { message?: unknown }; data?: { message?: unknown; msg?: unknown; error?: { message?: unknown } } };
    if (typeof data.error?.message === "string" && data.error.message) return data.error.message;
    if (typeof data.message === "string" && data.message) return data.message;
    if (typeof data.msg === "string" && data.msg) return data.msg;
    if (typeof data.data?.error?.message === "string" && data.data.error.message) return data.data.error.message;
    if (typeof data.data?.message === "string" && data.data.message) return data.data.message;
    if (typeof data.data?.msg === "string" && data.data.msg) return data.data.msg;
    return fallback;
}
