import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const items = [
    {
        id: "1",
        title: "电影人物",
        coverUrl: "https://images.example.com/portrait.webp",
        prompt: "cinematic portrait",
        description: "电影感人物创作",
        tags: ["人物", "电影"],
        category: "人物头像",
        model: "GPT Image 2",
        requiresReferenceImage: false,
        source: "OpenAI Collection",
        sourceId: "openai",
        githubUrl: "https://example.com/1",
        sourceUrl: "",
        license: "MIT",
        licenseUrl: "https://example.com/license",
        createdAt: "",
        updatedAt: "",
    },
    {
        id: "2",
        title: "产品海报",
        coverUrl: "https://images.example.com/poster.webp",
        prompt: "orange product poster",
        description: "",
        tags: ["产品", "海报"],
        category: "产品电商",
        model: "GPT-4o",
        requiresReferenceImage: false,
        source: "Poster Collection",
        sourceId: "poster",
        githubUrl: "https://example.com/2",
        sourceUrl: "",
        license: "MIT",
        licenseUrl: "",
        createdAt: "",
        updatedAt: "",
    },
    {
        id: "3",
        title: "品牌人物",
        coverUrl: "https://images.example.com/brand.webp",
        prompt: "brand portrait",
        description: "",
        tags: ["人物", "品牌"],
        category: "品牌营销",
        model: "Nano Banana Pro",
        requiresReferenceImage: true,
        source: "Brand Collection",
        sourceId: "brand",
        githubUrl: "https://example.com/3",
        sourceUrl: "https://example.com/original",
        license: "CC BY 4.0",
        licenseUrl: "https://example.com/license",
        createdAt: "",
        updatedAt: "",
    },
];

const library = {
    schemaVersion: 2,
    syncedAt: "2026-09-15T00:00:00.000Z",
    total: items.length,
    checksum: "library-checksum",
    sources: [
        { id: "openai", label: "OpenAI Collection", githubUrl: "https://example.com/1", license: "MIT", licenseUrl: "", model: "GPT Image 2", itemCount: 1, checksum: "1" },
        { id: "poster", label: "Poster Collection", githubUrl: "https://example.com/2", license: "MIT", licenseUrl: "", model: "GPT-4o", itemCount: 1, checksum: "2" },
        { id: "brand", label: "Brand Collection", githubUrl: "https://example.com/3", license: "CC BY 4.0", licenseUrl: "", model: "Nano Banana Pro", itemCount: 1, checksum: "3" },
    ],
    items,
};

beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(library), { status: 200, headers: { "Content-Type": "application/json" } })),
    );
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe("提示词库", () => {
    it("加载图文快照及其来源摘要", async () => {
        const { fetchPrompts } = await import("@/services/api/prompts");
        const result = await fetchPrompts();

        expect(fetch).toHaveBeenCalledWith("/prompt-library/index.json", { cache: "no-cache" });
        expect(result.items[0].coverUrl).toBe("https://images.example.com/portrait.webp");
        expect(result.library).toMatchObject({ schemaVersion: 2, total: 3 });
        expect(result.library.sources[0]).toMatchObject({ id: "openai" });
        expect(result.total).toBe(3);
    });

    it("兼容读取尚未更新的旧索引并解析相对封面地址", async () => {
        const legacyItem = {
            id: "legacy",
            title: "旧提示词",
            coverUrl: "images/legacy.webp",
            prompt: "legacy prompt",
            tags: ["需要参考图"],
            category: "其他",
            source: "YouMind / awesome-gpt-image-2",
            githubUrl: "https://example.com",
            preview: "旧版描述",
            createdAt: "",
            updatedAt: "",
        };
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ syncedAt: "2026-09-01T00:00:00.000Z", items: [legacyItem] }), { status: 200, headers: { "Content-Type": "application/json" } })),
        );
        const { fetchPrompts } = await import("@/services/api/prompts");
        const result = await fetchPrompts();

        expect(result.items[0]).toMatchObject({ model: "GPT Image 2", description: "旧版描述", requiresReferenceImage: true, coverUrl: "/prompt-library/images/legacy.webp" });
        expect(result.library.schemaVersion).toBe(1);
    });

    it("支持从远程对象存储读取索引", async () => {
        const libraryUrl = "https://res.cloudinary.com/demo/raw/upload/prompt-library/index.json";
        vi.stubEnv("VITE_PROMPT_LIBRARY_URL", libraryUrl);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ ...library, items: [{ ...items[0], coverUrl: "images/remote.webp" }] }), { status: 200, headers: { "Content-Type": "application/json" } })),
        );
        const { fetchPrompts } = await import("@/services/api/prompts");

        const result = await fetchPrompts();
        expect(fetch).toHaveBeenCalledWith(libraryUrl, { cache: "no-cache" });
        expect(result.items[0].coverUrl).toBe("https://res.cloudinary.com/demo/raw/upload/prompt-library/images/remote.webp");
    });

    it("支持按标题、提示词、描述和来源搜索", async () => {
        const { fetchPrompts } = await import("@/services/api/prompts");

        await expect(fetchPrompts({ keyword: "openai" })).resolves.toMatchObject({ total: 1, items: [{ id: "1" }] });
        await expect(fetchPrompts({ keyword: "orange" })).resolves.toMatchObject({ total: 1, items: [{ id: "2" }] });
        await expect(fetchPrompts({ keyword: "电影感" })).resolves.toMatchObject({ total: 1, items: [{ id: "1" }] });
    });

    it("支持按模型筛选并返回固定顺序的模型选项", async () => {
        const { fetchPrompts } = await import("@/services/api/prompts");
        const result = await fetchPrompts({ model: "Nano Banana Pro" });

        expect(result.items.map((item) => item.id)).toEqual(["3"]);
        expect(result.models).toEqual(["GPT Image 2", "Nano Banana Pro", "GPT-4o"]);
    });

    it("组合分类与标签筛选并返回标签计数", async () => {
        const { fetchPrompts } = await import("@/services/api/prompts");
        const result = await fetchPrompts({ tag: ["人物", "产品"] });

        expect(result.items.map((item) => item.id)).toEqual(["1", "2", "3"]);
        expect(result.tags.find((tag) => tag.name === "人物")?.count).toBe(2);
        expect(result.categories).toEqual(["人物头像", "产品电商", "品牌营销"]);
    });

    it("按分类切换对应的标签选项", async () => {
        const { fetchPrompts } = await import("@/services/api/prompts");
        const result = await fetchPrompts({ category: "人物头像" });

        expect(result.tags.map((tag) => tag.name)).toEqual(expect.arrayContaining(["人物", "电影"]));
        expect(result.tags.map((tag) => tag.name)).not.toContain("产品");
    });

    it("为无标签提示词补充其他并支持筛选", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ ...library, total: 1, items: [{ ...items[0], tags: [] }] }), { status: 200, headers: { "Content-Type": "application/json" } })),
        );
        const { fetchPrompts } = await import("@/services/api/prompts");
        const result = await fetchPrompts({ tag: ["其他"] });

        expect(result.items[0].tags).toEqual(["其他"]);
        expect(result.tags).toContainEqual({ name: "其他", count: 1 });
        expect(result.total).toBe(1);
    });

    it("分页返回稳定的总数", async () => {
        const { fetchPrompts } = await import("@/services/api/prompts");
        const result = await fetchPrompts({ page: 2, pageSize: 2 });

        expect(result.total).toBe(3);
        expect(result.items.map((item) => item.id)).toEqual(["3"]);
    });

    it("本地快照缺失时返回明确错误", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("missing", { status: 404 })),
        );
        const { fetchPrompts } = await import("@/services/api/prompts");

        await expect(fetchPrompts()).rejects.toThrow("本地提示词库不存在");
    });

    it("开发服务器回退到首页时返回明确错误", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response("<!doctype html>", { status: 200, headers: { "Content-Type": "text/html" } })),
        );
        const { fetchPrompts } = await import("@/services/api/prompts");

        await expect(fetchPrompts()).rejects.toThrow("本地提示词库不存在");
    });
});
