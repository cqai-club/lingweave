import { AccountClientError, CqaiAccountClient, type AccessTokenProvider, type AccountSummary, type BillingResponse, type CreateTopUpRequest } from "@cqaiclub/account-client";

import { ACCOUNT_SERVICE_ENABLED, ACCOUNT_SERVICE_URL } from "@/constant/logto";
import { buildApiUrl, type AiConfig } from "@/stores/use-config-store";

type AiRequestConfig = Pick<AiConfig, "apiKey" | "baseUrl" | "channelMode">;
type AccountAuthFailureHandler = () => void | Promise<void>;

const ACCOUNT_AUTH_FAILURE_CODES = new Set(["AUTH_TOKEN_REQUIRED", "AUTH_TOKEN_INVALID", "AUTH_TOKEN_EXPIRED", "AUTH_CLAIMS_INVALID", "NOT_AUTHENTICATED"]);
const ACCOUNT_AUTH_FAILURE_MESSAGE = /(?:登录(?:状态)?(?:已)?(?:失效|过期)|bearer access token is required|access token (?:is )?(?:invalid|expired|required)|not[_ -]?authenticated)/i;

let accessTokenProvider: AccessTokenProvider | undefined;
let accountClient: CqaiAccountClient | undefined;
let accountAuthFailureHandler: AccountAuthFailureHandler | undefined;
let accountAuthFailureNotified = false;

export function setAccountAccessTokenProvider(provider: AccessTokenProvider) {
    accessTokenProvider = provider;
    return () => {
        if (accessTokenProvider === provider) accessTokenProvider = undefined;
    };
}

export function setAccountAuthFailureHandler(handler: AccountAuthFailureHandler) {
    accountAuthFailureHandler = handler;
    accountAuthFailureNotified = false;
    return () => {
        if (accountAuthFailureHandler === handler) accountAuthFailureHandler = undefined;
    };
}

export function isAccountAiConfig(config: Pick<AiConfig, "channelMode">) {
    return ACCOUNT_SERVICE_ENABLED && config.channelMode === "remote";
}

export async function getAccountSummary(signal?: AbortSignal): Promise<AccountSummary> {
    return withAccountAuthHandling(() => getAccountClient().getAccount(signal));
}

export async function getTopUpInfo(signal?: AbortSignal) {
    return withAccountAuthHandling(() => getAccountClient().getTopUpInfo(signal));
}

export async function listTopUps(options: { page?: number; pageSize?: number; keyword?: string } = {}, signal?: AbortSignal) {
    return withAccountAuthHandling(() => getAccountClient().listTopUps(options, signal));
}

export async function createTopUp(body: CreateTopUpRequest, signal?: AbortSignal): Promise<BillingResponse> {
    return withAccountAuthHandling(() => getAccountClient().createTopUp(body, signal ? { signal } : {}));
}

export async function requestAi(config: AiRequestConfig, path: string, init: RequestInit = {}) {
    if (isAccountAiConfig(config)) {
        try {
            const response = await getAccountClient().request(accountServicePath(path), init);
            if (response.status === 401) notifyAccountAuthFailure();
            return response;
        } catch (error) {
            if (isAccountAuthFailureError(error)) {
                notifyAccountAuthFailure();
                throw new Error("请先登录 CQ AI Club");
            }
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
    if (isAccountAiConfig(config)) assertAccountAuthentication(response.status, payload);
    if (!response.ok || isBusinessFailure(payload)) throw new Error(responseErrorMessage(payload, `AI 请求失败（${response.status}）`));
    return payload as T;
}

export async function requestAiBlob(config: AiRequestConfig, path: string, init: RequestInit = {}) {
    const response = await requestAi(config, path, init);
    if (!response.ok) {
        const text = await response.text();
        const payload = parseOptionalJsonPayload(text);
        if (isAccountAiConfig(config)) assertAccountAuthentication(response.status, payload);
        throw new Error(responseErrorMessage(payload, `AI 请求失败（${response.status}）`));
    }
    await assertAiResponse(response, "AI 请求失败", isAccountAiConfig(config));
    return response.blob();
}

export async function assertAiResponse(response: Response, fallback: string, accountAuthentication = false) {
    if (!response.ok) {
        const payload = parseOptionalJsonPayload(await response.clone().text());
        if (accountAuthentication) assertAccountAuthentication(response.status, payload);
        throw new Error(`${fallback}（${response.status}）`);
    }
    if (response.headers.get("content-type")?.toLowerCase().includes("json")) {
        const payload = parseJsonPayload(await response.clone().text(), response.status);
        if (accountAuthentication) assertAccountAuthentication(response.status, payload);
        if (isBusinessFailure(payload)) throw new Error(responseErrorMessage(payload, `${fallback}（${response.status}）`));
    }
}

async function withAccountAuthHandling<T>(request: () => Promise<T>) {
    try {
        return await request();
    } catch (error) {
        if (isAccountAuthFailureError(error)) notifyAccountAuthFailure();
        throw error;
    }
}

function assertAccountAuthentication(status: number, payload: unknown) {
    if (status !== 401 && !isAccountAuthFailurePayload(payload)) return;
    notifyAccountAuthFailure();
    throw new Error("请先登录 CQ AI Club");
}

function notifyAccountAuthFailure() {
    const handler = accountAuthFailureHandler;
    if (!handler || accountAuthFailureNotified) return;
    accountAuthFailureNotified = true;
    try {
        void Promise.resolve(handler()).catch(() => undefined);
    } catch {
        // 登录失效通知不应覆盖原接口错误。
    }
}

function isAccountAuthFailureError(error: unknown) {
    if (error instanceof AccountClientError) {
        return error.status === 401 || isAccountAuthFailureCode(error.code) || ACCOUNT_AUTH_FAILURE_MESSAGE.test(error.message);
    }
    return error instanceof Error && ACCOUNT_AUTH_FAILURE_MESSAGE.test(error.message);
}

function isAccountAuthFailurePayload(payload: unknown): boolean {
    if (typeof payload === "string") return ACCOUNT_AUTH_FAILURE_MESSAGE.test(payload);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const data = payload as Record<string, unknown>;
    if (isAccountAuthFailureCode(data.code) || isAccountAuthFailureMessage(data.message) || isAccountAuthFailureMessage(data.msg)) return true;
    return isAccountAuthFailurePayload(data.error) || isAccountAuthFailurePayload(data.data);
}

function isAccountAuthFailureCode(code: unknown) {
    return typeof code === "string" && ACCOUNT_AUTH_FAILURE_CODES.has(code.toUpperCase());
}

function isAccountAuthFailureMessage(message: unknown) {
    return typeof message === "string" && ACCOUNT_AUTH_FAILURE_MESSAGE.test(message);
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
