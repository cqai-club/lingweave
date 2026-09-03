import { beforeEach, describe, expect, it } from "vitest";

import {
    buildApiUrl,
    createModelChannel,
    defaultConfig,
    encodeChannelModel,
    getEffectiveConfig,
    modelOptionsFromChannels,
    resolveModelRequestConfig,
    selectableModelsByCapability,
    stripLocalAiCredentials,
    syncConfigWithChannels,
    useConfigStore,
} from "@/stores/use-config-store";

beforeEach(() => {
    window.localStorage.clear();
    useConfigStore.setState({ config: structuredClone(defaultConfig) });
});

describe("API URL", () => {
    it("为普通 OpenAI 地址补充 v1", () => {
        expect(buildApiUrl("https://api.example.com/", "/models")).toBe("https://api.example.com/v1/models");
        expect(buildApiUrl("https://api.example.com/v1", "/images/generations")).toBe("https://api.example.com/v1/images/generations");
    });

    it("规范化火山方舟 Agent Plan 地址", () => {
        expect(buildApiUrl("https://ark.example.com/api/plan/v3/unused?token=ignored", "/contents/generations/tasks")).toBe("https://ark.example.com/api/plan/v3/contents/generations/tasks");
    });
});

describe("模型渠道", () => {
    it("按编码后的模型选择正确渠道", () => {
        const channels = [
            createModelChannel({ id: "first", baseUrl: "https://first.example.com", apiKey: "first-key", models: ["shared-model"] }),
            createModelChannel({ id: "second", baseUrl: "https://second.example.com", apiKey: "second-key", models: ["shared-model"] }),
        ];
        const config = { ...structuredClone(defaultConfig), channels, models: modelOptionsFromChannels(channels) };
        const requestConfig = resolveModelRequestConfig(config, encodeChannelModel("second", "shared-model"));

        expect(requestConfig.model).toBe("shared-model");
        expect(requestConfig.baseUrl).toBe("https://second.example.com");
        expect(requestConfig.apiKey).toBe("second-key");
    });

    it("按渠道保留文本调用协议", () => {
        const channels = [createModelChannel({ id: "default", textProtocol: "responses", models: ["gpt-test"], modelsLoaded: true })];
        const config = syncConfigWithChannels({ ...structuredClone(defaultConfig), channels, models: modelOptionsFromChannels(channels), textModels: ["default::gpt-test"], textModel: "default::gpt-test" }, channels);

        expect(resolveModelRequestConfig(config, "default::gpt-test", "text").textProtocol).toBe("responses");
    });

    it("本地模式持久化渠道配置，账号服务模式持久化时清理密钥", () => {
        useConfigStore.getState().updateConfig("apiKey", "local-secret");
        const partialize = useConfigStore.persist.getOptions().partialize;
        const persisted = partialize?.(useConfigStore.getState()) as Record<string, unknown>;

        expect(getEffectiveConfig().apiKey).toBe("local-secret");
        expect((persisted.config as { apiKey: string }).apiKey).toBe(defaultConfig.channelMode === "remote" ? "" : "local-secret");
        expect(Object.keys(persisted).sort()).toEqual(["config", "webdav"]);
    });

    it("账号服务模式清理顶层和渠道中的本地 API Key", () => {
        const config = {
            ...structuredClone(defaultConfig),
            apiKey: "top-level-secret",
            channels: [createModelChannel({ id: "default", baseUrl: "https://ai.example.com", apiKey: "channel-secret", models: ["gpt-test"] })],
        };

        const sanitized = stripLocalAiCredentials(config);

        expect(sanitized.apiKey).toBe("");
        expect(sanitized.channels[0]?.apiKey).toBe("");
        expect(sanitized.channels[0]?.baseUrl).toBe("https://ai.example.com");
        expect(sanitized.channels[0]?.models).toEqual(["gpt-test"]);
    });

    it("只保留已获取且能力匹配的模型，并同步默认模型", () => {
        const channels = [createModelChannel({ id: "default", models: ["gpt-image-2", "sora-2", "gpt-5.5", "gpt-4o-mini-tts"], modelsLoaded: true })];
        const config = syncConfigWithChannels(
            {
                ...structuredClone(defaultConfig),
                imageModels: ["missing-image", "default::gpt-image-2", "default::gpt-5.5"],
                imageModel: "missing-image",
            },
            channels,
        );

        expect(config.imageModels).toEqual(["default::gpt-image-2"]);
        expect(config.imageModel).toBe("default::gpt-image-2");
        expect(selectableModelsByCapability(config, "video")).toEqual(["default::sora-2"]);
        expect(selectableModelsByCapability(config, "text")).toEqual(["default::gpt-5.5"]);
        expect(selectableModelsByCapability(config, "audio")).toEqual(["default::gpt-4o-mini-tts"]);
    });

    it("模型列表清空后同步清空能力可选项和默认模型", () => {
        const config = syncConfigWithChannels(
            {
                ...structuredClone(defaultConfig),
                imageModels: ["default::gpt-image-2"],
                imageModel: "default::gpt-image-2",
            },
            [createModelChannel({ id: "default", models: [] })],
        );

        expect(config.models).toEqual([]);
        expect(config.imageModels).toEqual([]);
        expect(config.imageModel).toBe("");
    });

    it("请求前拒绝未获取或能力不匹配的模型", () => {
        const config = syncConfigWithChannels(structuredClone(defaultConfig), [createModelChannel({ id: "default", models: ["gpt-image-2", "gpt-5.5"], modelsLoaded: true })]);

        expect(() => resolveModelRequestConfig(config, "default::missing", "image")).toThrow("不在已获取的模型列表中");
        expect(() => resolveModelRequestConfig(config, "default::gpt-5.5", "image")).toThrow("不支持或未启用生图能力");
        expect(resolveModelRequestConfig(config, "default::gpt-image-2", "image").model).toBe("gpt-image-2");
    });

    it("账号服务模式不使用未标记为已获取的旧模型列表", () => {
        const config = syncConfigWithChannels(structuredClone(defaultConfig), [createModelChannel({ id: "default", models: ["gpt-image-2"] })]);

        expect(config.models).toEqual(defaultConfig.channelMode === "remote" ? [] : ["default::gpt-image-2"]);
    });
});
