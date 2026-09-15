export type Prompt = {
    id: string;
    title: string;
    coverUrl: string;
    prompt: string;
    description: string;
    tags: string[];
    category: string;
    model: string;
    requiresReferenceImage: boolean;
    source: string;
    sourceId: string;
    githubUrl: string;
    sourceUrl: string;
    license: string;
    licenseUrl: string;
    createdAt: string;
    updatedAt: string;
};

export type PromptLibrarySource = {
    id: string;
    label: string;
    githubUrl: string;
    license: string;
    licenseUrl: string;
    model: string;
    itemCount: number;
    checksum: string;
};

export type PromptLibrarySummary = {
    schemaVersion: number;
    syncedAt: string;
    total: number;
    checksum: string;
    sources: PromptLibrarySource[];
};

export type PromptTagOption = {
    name: string;
    count: number;
};

export const ALL_PROMPTS_OPTION = "全部";

export type PromptListResponse = {
    items: Prompt[];
    tags: PromptTagOption[];
    categories: string[];
    models: string[];
    total: number;
    library: PromptLibrarySummary;
};

type PromptLibraryPayload = {
    schemaVersion?: unknown;
    syncedAt?: unknown;
    total?: unknown;
    checksum?: unknown;
    sources?: unknown;
    items?: unknown;
};

type LoadedPromptLibrary = {
    items: Prompt[];
    summary: PromptLibrarySummary;
};

const configuredLibraryUrl = import.meta.env.VITE_PROMPT_LIBRARY_URL?.trim();
const libraryIndexUrl = configuredLibraryUrl || import.meta.env.BASE_URL + "prompt-library/index.json";
const libraryBaseUrl = configuredLibraryUrl?.replace(/\/index\.json(?:\?.*)?$/, "") || import.meta.env.BASE_URL + "prompt-library";
const categoryOrder = ["人物头像", "产品电商", "海报设计", "品牌营销", "插画艺术", "信息图", "影视分镜", "社交媒体", "UI设计", "图像编辑", "其他"];
const modelOrder = ["GPT Image 2", "Nano Banana Pro", "GPT-4o"];
let promptLibrary: LoadedPromptLibrary | null = null;
let loadingPrompts: Promise<LoadedPromptLibrary> | null = null;

export async function fetchPrompts({
    keyword = "",
    tag = [],
    category = ALL_PROMPTS_OPTION,
    model = ALL_PROMPTS_OPTION,
    page = 1,
    pageSize = 20,
}: {
    keyword?: string;
    tag?: string[];
    category?: string;
    model?: string;
    page?: number;
    pageSize?: number;
} = {}): Promise<PromptListResponse> {
    const library = await getPromptLibrary();
    const normalizedKeyword = keyword.trim().toLowerCase();
    const normalizedPage = Math.max(1, page);
    const normalizedPageSize = Math.max(1, Math.min(100, pageSize));
    const withoutTagFilter = filterPrompts(library.items, { keyword: normalizedKeyword, category, model, tags: [] });
    const filtered = filterPrompts(library.items, { keyword: normalizedKeyword, category, model, tags: tag });

    return {
        items: filtered.slice((normalizedPage - 1) * normalizedPageSize, normalizedPage * normalizedPageSize),
        tags: collectTags(withoutTagFilter),
        categories: categoryOrder.filter((option) => library.items.some((item) => item.category === option)),
        models: modelOrder.filter((option) => library.items.some((item) => item.model === option)),
        total: filtered.length,
        library: library.summary,
    };
}

async function getPromptLibrary() {
    if (promptLibrary) return promptLibrary;
    if (loadingPrompts) return loadingPrompts;
    loadingPrompts = fetch(libraryIndexUrl, { cache: "no-cache" })
        .then(async (response) => {
            if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("本地提示词库不存在，请先执行 npm run prepare:prompts");
            const payload = (await response.json()) as PromptLibraryPayload;
            if (!Array.isArray(payload.items)) throw new Error("本地提示词库格式无效，请重新执行 npm run prepare:prompts");
            const items = payload.items.map(normalizePrompt).filter((item): item is Prompt => Boolean(item));
            if (!items.length) throw new Error("本地提示词库格式无效，请重新执行 npm run prepare:prompts");
            promptLibrary = { items, summary: normalizeLibrarySummary(payload, items) };
            return promptLibrary;
        })
        .finally(() => {
            loadingPrompts = null;
        });
    return loadingPrompts;
}

function normalizePrompt(value: unknown): Prompt | null {
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const id = textValue(item.id);
    const title = textValue(item.title);
    const prompt = textValue(item.prompt);
    if (!id || !title || !prompt) return null;
    const source = textValue(item.source);
    const normalizedTags = Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())) : [];
    const tags = normalizedTags.length ? normalizedTags : ["其他"];

    return {
        id,
        title,
        coverUrl: resolveCoverUrl(textValue(item.coverUrl)),
        prompt,
        description: textValue(item.description) || textValue(item.preview),
        tags,
        category: textValue(item.category) || "其他",
        model: textValue(item.model) || inferModel(source),
        requiresReferenceImage: typeof item.requiresReferenceImage === "boolean" ? item.requiresReferenceImage : tags.includes("需要参考图"),
        source,
        sourceId: textValue(item.sourceId) || inferSourceId(source),
        githubUrl: textValue(item.githubUrl),
        sourceUrl: textValue(item.sourceUrl),
        license: textValue(item.license) || inferLicense(source),
        licenseUrl: textValue(item.licenseUrl),
        createdAt: textValue(item.createdAt),
        updatedAt: textValue(item.updatedAt),
    };
}

function normalizeLibrarySummary(payload: PromptLibraryPayload, items: Prompt[]): PromptLibrarySummary {
    return {
        schemaVersion: numberValue(payload.schemaVersion) || 1,
        syncedAt: textValue(payload.syncedAt),
        total: items.length,
        checksum: textValue(payload.checksum),
        sources: normalizeSources(payload.sources, items),
    };
}

function normalizeSources(value: unknown, items: Prompt[]) {
    if (Array.isArray(value)) {
        const sources = value
            .map((entry) => {
                if (!entry || typeof entry !== "object") return null;
                const source = entry as Record<string, unknown>;
                const id = textValue(source.id);
                const sourceItems = items.filter((item) => item.sourceId === id);
                return {
                    id,
                    label: textValue(source.label) || sourceItems[0]?.source || id,
                    githubUrl: textValue(source.githubUrl) || sourceItems[0]?.githubUrl || "",
                    license: textValue(source.license) || sourceItems[0]?.license || "",
                    licenseUrl: textValue(source.licenseUrl) || sourceItems[0]?.licenseUrl || "",
                    model: textValue(source.model) || sourceItems[0]?.model || "",
                    itemCount: numberValue(source.itemCount) || sourceItems.length,
                    checksum: textValue(source.checksum),
                } satisfies PromptLibrarySource;
            })
            .filter((source): source is PromptLibrarySource => Boolean(source?.id));
        if (sources.length) return sources;
    }

    return Array.from(new Set(items.map((item) => item.sourceId))).map((id) => {
        const sourceItems = items.filter((item) => item.sourceId === id);
        const item = sourceItems[0];
        return {
            id,
            label: item.source,
            githubUrl: item.githubUrl,
            license: item.license,
            licenseUrl: item.licenseUrl,
            model: item.model,
            itemCount: sourceItems.length,
            checksum: "",
        };
    });
}

function filterPrompts(items: Prompt[], options: { keyword: string; category: string; model: string; tags: string[] }) {
    return items.filter((item) => {
        if (isActiveOption(options.category) && item.category !== options.category) return false;
        if (isActiveOption(options.model) && item.model !== options.model) return false;
        if (options.tags.length && !options.tags.some((tag) => item.tags.includes(tag))) return false;
        if (!options.keyword) return true;
        return [item.title, item.prompt, item.description, item.category, item.model, item.source, ...item.tags].join(" ").toLowerCase().includes(options.keyword);
    });
}

function collectTags(items: Prompt[]) {
    const counts = new Map<string, number>();
    for (const item of items) {
        for (const tag of item.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
}

function inferModel(source: string) {
    if (/nano.?banana/i.test(source)) return "Nano Banana Pro";
    if (/gpt.?4o/i.test(source)) return "GPT-4o";
    return "GPT Image 2";
}

function inferSourceId(source: string) {
    if (/zerolu/i.test(source)) return "awesome-gpt-image";
    if (/imgedify/i.test(source)) return "awesome-gpt4o-image-prompts";
    if (/nano.?banana/i.test(source)) return "youmind-nano-banana-pro";
    if (/youmind/i.test(source)) return "youmind-gpt-image-2";
    if (/davidwu/i.test(source)) return "davidwu-gpt-image2-prompts";
    return (
        source
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "legacy"
    );
}

function inferLicense(source: string) {
    if (/youmind/i.test(source)) return "CC BY 4.0";
    if (/zerolu|imgedify/i.test(source)) return "MIT";
    return "未单独声明";
}

function textValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function resolveCoverUrl(value: string) {
    if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value;
    return libraryBaseUrl.replace(/\/$/, "") + "/" + value.replace(/^\//, "");
}

function isActiveOption(value: string) {
    return value && value !== ALL_PROMPTS_OPTION && value !== "all";
}

export function formatPromptDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
