import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("Account Service AI 请求", () => {
    it("读取当前账号额度且只携带 Logto access token", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { userId: 7, platform: "lingweave", quota: 500000, quotaUsed: 125000 } }), { status: 200, headers: { "Content-Type": "application/json" } }));
        vi.stubGlobal("fetch", fetchMock);
        const { getAccountSummary, setAccountAccessTokenProvider } = await import("@/services/api/account");
        setAccountAccessTokenProvider(() => "logto-access-token");

        await expect(getAccountSummary()).resolves.toMatchObject({ userId: 7, quota: 500000, quotaUsed: 125000 });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://account.example.test/api/account");
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer logto-access-token");
    });

    it("使用 Logto access token 调用账号服务且不暴露 NewAPI Key", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ data: [{ id: "gpt-test" }] }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);
        const { requestAiJson, setAccountAccessTokenProvider } = await import("@/services/api/account");
        const cleanup = setAccountAccessTokenProvider(async () => "logto-access-token");

        const payload = await requestAiJson<{ data: Array<{ id: string }> }>({ channelMode: "remote", baseUrl: "", apiKey: "" }, "/models");

        expect(payload.data[0]?.id).toBe("gpt-test");
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://account.example.test/v1/models");
        expect(new Headers(init.headers).get("Authorization")).toBe("Bearer logto-access-token");
        expect(init.credentials).toBe("omit");
        cleanup();
    });

    it("绑定浏览器 fetch 的全局上下文", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        const fetchMock = vi.fn(function (this: unknown) {
            expect(this).toBe(globalThis);
            return Promise.resolve(new Response(JSON.stringify({ data: [{ id: "gpt-test" }] }), { status: 200 }));
        });
        vi.stubGlobal("fetch", fetchMock);
        const { requestAiJson, setAccountAccessTokenProvider } = await import("@/services/api/account");
        setAccountAccessTokenProvider(() => "logto-access-token");

        await expect(requestAiJson({ channelMode: "remote", baseUrl: "", apiKey: "" }, "/models")).resolves.toMatchObject({ data: [{ id: "gpt-test" }] });
    });

    it("把 HTML 网关响应转换成可读错误", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html>", { status: 502 })));
        const { requestAiJson, setAccountAccessTokenProvider } = await import("@/services/api/account");
        setAccountAccessTokenProvider(() => "logto-access-token");

        await expect(requestAiJson({ channelMode: "remote", baseUrl: "", apiKey: "" }, "/models")).rejects.toThrow("AI 服务返回了非 JSON 响应（502）");
    });

    it("识别 HTTP 200 的业务失败响应", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: "账号额度不足" }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ code: false, msg: "模型不可用" }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);
        const { requestAiJson, setAccountAccessTokenProvider } = await import("@/services/api/account");
        setAccountAccessTokenProvider(() => "logto-access-token");

        await expect(requestAiJson({ channelMode: "remote", baseUrl: "", apiKey: "" }, "/models")).rejects.toThrow("账号额度不足");
        await expect(requestAiJson({ channelMode: "remote", baseUrl: "", apiKey: "" }, "/models")).rejects.toThrow("模型不可用");
    });

    it("不把 HTTP 200 的 JSON 业务失败当成二进制结果", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ success: false, data: { message: "音频额度不足" } }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        );
        const { requestAiBlob, setAccountAccessTokenProvider } = await import("@/services/api/account");
        setAccountAccessTokenProvider(() => "logto-access-token");

        await expect(requestAiBlob({ channelMode: "remote", baseUrl: "", apiKey: "" }, "/audio/speech")).rejects.toThrow("音频额度不足");
    });

    it("账号接口返回 401 时通知登录状态失效", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ success: false, code: "AUTH_TOKEN_INVALID", message: "Access token is invalid or expired" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        );
        const { getAccountSummary, setAccountAccessTokenProvider, setAccountAuthFailureHandler } = await import("@/services/api/account");
        const onAuthFailure = vi.fn();
        setAccountAccessTokenProvider(() => "expired-logto-access-token");
        setAccountAuthFailureHandler(onAuthFailure);

        await expect(getAccountSummary()).rejects.toThrow("Access token is invalid or expired");
        expect(onAuthFailure).toHaveBeenCalledOnce();
    });

    it("识别 HTTP 200 响应体中的登录失效信息", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, code: "AUTH_TOKEN_INVALID", message: "登录已失效" }), { status: 200 })));
        const { requestAiJson, setAccountAccessTokenProvider, setAccountAuthFailureHandler } = await import("@/services/api/account");
        const onAuthFailure = vi.fn();
        setAccountAccessTokenProvider(() => "expired-logto-access-token");
        setAccountAuthFailureHandler(onAuthFailure);

        await expect(requestAiJson({ channelMode: "remote", baseUrl: "", apiKey: "" }, "/models")).rejects.toThrow("请先登录 CQ AI Club");
        expect(onAuthFailure).toHaveBeenCalledOnce();
    });

    it("权限不足不会被当作登录失效", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, code: "AUTH_SCOPE_FORBIDDEN", message: "缺少 ai:invoke 权限" }), { status: 403 })),
        );
        const { requestAiJson, setAccountAccessTokenProvider, setAccountAuthFailureHandler } = await import("@/services/api/account");
        const onAuthFailure = vi.fn();
        setAccountAccessTokenProvider(() => "valid-logto-access-token");
        setAccountAuthFailureHandler(onAuthFailure);

        await expect(requestAiJson({ channelMode: "remote", baseUrl: "", apiKey: "" }, "/models")).rejects.toThrow("缺少 ai:invoke 权限");
        expect(onAuthFailure).not.toHaveBeenCalled();
    });

    it("本地渠道 API Key 失效不会退出 Logto", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "API key is invalid" }), { status: 401 })));
        const { requestAiJson, setAccountAuthFailureHandler } = await import("@/services/api/account");
        const onAuthFailure = vi.fn();
        setAccountAuthFailureHandler(onAuthFailure);

        await expect(requestAiJson({ channelMode: "local", baseUrl: "https://ai.example.test", apiKey: "invalid-key" }, "/models")).rejects.toThrow("API key is invalid");
        expect(onAuthFailure).not.toHaveBeenCalled();
    });
});
