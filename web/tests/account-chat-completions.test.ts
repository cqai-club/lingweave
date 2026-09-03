import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe("账号服务 Chat Completions 兼容层", () => {
    it("把 Responses 输入转换为 Chat Completions 并解析流式文本", async () => {
        vi.stubEnv("VITE_LOGTO_APP_ID", "lingweave-app");
        vi.stubEnv("VITE_LOGTO_API_RESOURCE", "https://account.example.test");
        vi.stubEnv("VITE_ACCOUNT_SERVICE_URL", "https://account.example.test");
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(
                [
                    `data: ${JSON.stringify({ choices: [{ delta: { content: "你好" } }] })}`,
                    `data: ${JSON.stringify({ choices: [{ delta: { content: "，灵织" } }] })}`,
                    "data: [DONE]",
                    "",
                ].join("\n\n"),
                { status: 200, headers: { "Content-Type": "text/event-stream" } },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        const { defaultConfig, createModelChannel } = await import("@/stores/use-config-store");
        const { requestImageQuestion } = await import("@/services/api/image");
        const { setAccountAccessTokenProvider } = await import("@/services/api/account");
        setAccountAccessTokenProvider(() => "logto-access-token");
        const config = {
            ...structuredClone(defaultConfig),
            channelMode: "remote" as const,
            channels: [createModelChannel({ id: "default", textProtocol: "chat-completions", models: ["gpt-test"], modelsLoaded: true })],
            models: ["default::gpt-test"],
            textModels: ["default::gpt-test"],
            textModel: "default::gpt-test",
        };
        const deltas: string[] = [];

        await expect(requestImageQuestion(config, [{ role: "user", content: "你好" }], (text) => deltas.push(text))).resolves.toBe("你好，灵织");
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://account.example.test/v1/chat/completions");
        expect(JSON.parse(String(init.body))).toMatchObject({ model: "gpt-test", messages: [{ role: "user", content: "你好" }], stream: true });
        expect(deltas).toEqual(["你好", "你好，灵织"]);
    });
});
