import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

import { assertPromptLibrary, normalizePromptBody, promptExclusionReason, promptItemsChecksum, PROMPT_LIBRARY_SCHEMA_VERSION } from "./prompt-library-schema.mjs";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(webDir, "public", "prompt-library");
const tempDir = outputDir + ".tmp";
const uploadToCloudinary = process.argv.includes("--cloudinary");
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
const cloudinaryFolder = process.env.CLOUDINARY_FOLDER || "lingweave/prompt-library";

if (uploadToCloudinary) {
    const { CLOUDINARY_API_KEY: api_key, CLOUDINARY_API_SECRET: api_secret } = process.env;
    if (!cloudinaryCloudName || !api_key || !api_secret) throw new Error("Cloudinary 配置不完整");
    cloudinary.config({ cloud_name: cloudinaryCloudName, api_key, api_secret, secure: true });
    console.log("Cloudinary 目标：" + cloudinaryCloudName + "/" + cloudinaryFolder);
}

const sources = {
    awesomeGptImage: {
        category: "awesome-gpt-image",
        label: "ZeroLu / awesome-gpt-image",
        githubUrl: "https://github.com/ZeroLu/awesome-gpt-image",
        rawBase: "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main",
        model: "GPT Image 2",
        license: "MIT",
        licenseUrl: "https://github.com/ZeroLu/awesome-gpt-image/blob/main/LICENSE",
        minimumItems: 40,
    },
    awesomeGpt4oImagePrompts: {
        category: "awesome-gpt4o-image-prompts",
        label: "ImgEdify / Awesome-GPT4o-Image-Prompts",
        githubUrl: "https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts",
        rawBase: "https://raw.githubusercontent.com/ImgEdify/Awesome-GPT4o-Image-Prompts/main",
        model: "GPT-4o",
        license: "MIT",
        licenseUrl: "https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts/blob/main/LICENSE",
        minimumItems: 60,
    },
    youMindGptImage2: {
        category: "youmind-gpt-image-2",
        label: "YouMind / awesome-gpt-image-2",
        githubUrl: "https://github.com/YouMind-OpenLab/awesome-gpt-image-2",
        rawBase: "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main",
        model: "GPT Image 2",
        license: "CC BY 4.0",
        licenseUrl: "https://github.com/YouMind-OpenLab/awesome-gpt-image-2/blob/main/LICENSE",
        minimumItems: 80,
    },
    youMindNanoBananaPro: {
        category: "youmind-nano-banana-pro",
        label: "YouMind / awesome-nano-banana-pro-prompts",
        githubUrl: "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts",
        rawBase: "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/main",
        model: "Nano Banana Pro",
        license: "CC BY 4.0",
        licenseUrl: "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/blob/main/LICENSE",
        minimumItems: 80,
    },
    davidWuGptImage2: {
        category: "davidwu-gpt-image2-prompts",
        label: "DavidWu / awesome-gpt-image2-prompts",
        githubUrl: "https://github.com/davidwuw0811-boop/awesome-gpt-image2-prompts",
        rawBase: "https://raw.githubusercontent.com/davidwuw0811-boop/awesome-gpt-image2-prompts/main",
        model: "GPT Image 2",
        license: "未单独声明",
        licenseUrl: "",
        minimumItems: 400,
    },
    freestyleflyGptImage2: {
        category: "freestylefly-awesome-gpt-image-2",
        label: "freestylefly / awesome-gpt-image-2",
        githubUrl: "https://github.com/freestylefly/awesome-gpt-image-2",
        rawBase: "https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main",
        model: "GPT Image 2",
        license: "MIT（第三方内容依原来源）",
        licenseUrl: "https://github.com/freestylefly/awesome-gpt-image-2/blob/main/LICENSE",
        minimumItems: 500,
    },
};

const tagAliases = new Map([
    ["ui", "UI设计"],
    ["ui与界面", "UI设计"],
    ["3d", "3D"],
    ["architecture", "建筑空间"],
    ["brand", "品牌"],
    ["character", "人物角色"],
    ["characters", "人物角色"],
    ["charts", "图表"],
    ["classical", "古典"],
    ["commerce", "商业"],
    ["documents", "文档出版"],
    ["education", "教育"],
    ["fashion", "时尚"],
    ["history", "历史"],
    ["other use cases", "其他"],
    ["photography", "摄影"],
    ["products", "产品展示"],
    ["realistic", "写实"],
    ["scenes", "场景叙事"],
    ["social", "社交媒体"],
    ["story", "故事叙事"],
    ["tech", "科技"],
    ["travel", "旅行"],
    ["poster", "海报"],
    ["海报设计", "海报"],
    ["portrait", "人物肖像"],
    ["个人资料", "人物肖像"],
    ["头像", "人物肖像"],
    ["illustration", "插画"],
    ["anime", "动漫插画"],
    ["anime_illustration", "动漫插画"],
    ["infographic", "信息图"],
    ["信息图设计", "信息图"],
    ["product", "产品展示"],
    ["product_poster", "产品海报"],
    ["3d_cute", "3D"],
    ["other", "其他"],
    ["creative", "创意设计"],
    ["food", "美食摄影"],
    ["illustration_map", "插画地图"],
    ["game_scifi", "游戏科幻"],
    ["anime_adaptation", "动漫改编"],
    ["social_dance", "社交舞蹈"],
    ["wuxia_history", "武侠历史"],
    ["dance_action", "舞蹈动作"],
    ["vfx_fantasy", "奇幻特效"],
]);

const freestyleflyCategoryAliases = new Map([
    ["Charts & Infographics", "信息图"],
    ["Products & E-commerce", "产品电商"],
    ["Posters & Typography", "海报设计"],
    ["Documents & Publishing", "信息图"],
    ["Illustration & Art", "插画艺术"],
    ["Scenes & Storytelling", "影视分镜"],
    ["Characters & People", "人物头像"],
    ["Brand & Logos", "品牌营销"],
    ["UI & Interfaces", "UI设计"],
    ["History & Classical Themes", "影视分镜"],
]);

await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });

console.log("正在读取上游提示词...");
const sourceList = Object.values(sources);
const groups = await Promise.all([
    buildAwesomeGptImagePrompts(sources.awesomeGptImage),
    buildAwesomeGpt4oImagePrompts(sources.awesomeGpt4oImagePrompts),
    buildYouMindPrompts(sources.youMindGptImage2),
    buildYouMindPrompts(sources.youMindNanoBananaPro),
    buildDavidWuGptImage2Prompts(sources.davidWuGptImage2),
    buildFreestyleflyGptImage2Prompts(sources.freestyleflyGptImage2),
]);

groups.forEach((items, index) => {
    const source = sourceList[index];
    if (items.length < source.minimumItems) throw new Error(source.label + " 仅解析出 " + items.length + " 条，低于安全阈值 " + source.minimumItems);
});

const excludedPrompts = groups
    .flat()
    .map((item) => promptExclusionReason(item.prompt))
    .filter(Boolean);
const curatedGroups = groups.map((sourceItems) => sourceItems.filter((item) => !promptExclusionReason(item.prompt)));
if (excludedPrompts.length) {
    const unavailableCount = excludedPrompts.filter((reason) => reason === "unavailable").length;
    const simpleCount = excludedPrompts.filter((reason) => reason === "too-simple").length;
    console.log("质量过滤：剔除 " + excludedPrompts.length + " 条（原文不可用 " + unavailableCount + "，信息量过低 " + simpleCount + "）");
}

const items = deduplicatePrompts(curatedGroups.flat());
const librarySources = sourceList.map((source) => {
    const sourceItems = items.filter((item) => item.sourceId === source.category);
    return {
        id: source.category,
        label: source.label,
        githubUrl: source.githubUrl,
        license: source.license,
        licenseUrl: source.licenseUrl,
        model: source.model,
        itemCount: sourceItems.length,
        checksum: promptItemsChecksum(sourceItems),
    };
});
const library = {
    schemaVersion: PROMPT_LIBRARY_SCHEMA_VERSION,
    syncedAt: new Date().toISOString(),
    total: items.length,
    checksum: promptItemsChecksum(items),
    sources: librarySources,
    items,
};

assertPromptLibrary(library);
const indexPath = join(tempDir, "index.json");
await writeFile(indexPath, JSON.stringify(library) + "\n");

if (uploadToCloudinary) {
    await cloudinary.uploader.upload(indexPath, {
        resource_type: "raw",
        public_id: cloudinaryFolder + "/index.json",
        overwrite: true,
        invalidate: true,
    });
    console.log("索引已发布：https://res.cloudinary.com/" + cloudinaryCloudName + "/raw/upload/" + cloudinaryFolder + "/index.json");
}

await rm(outputDir, { recursive: true, force: true });
await rename(tempDir, outputDir);
console.log("同步完成：" + items.length + " 条提示词，" + outputDir);

async function buildAwesomeGptImagePrompts(source) {
    const markdown = await fetchText(source.rawBase, "README.zh-CN.md");
    const items = [];
    for (const section of splitBeforeHeading(markdown, "## ")) {
        const tags = tagsFromHeading(firstMatch(section, /^##\s+(.+)$/m));
        for (const block of splitBeforeHeading(section, "### ")) {
            const title = firstMatch(block, /^###\s+(.+)$/m)
                .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
                .trim();
            const prompt = firstMatch(block, /\*\*提示词:\*\*\s*\r?\n\s*\x60{3}[\w-]*\r?\n(.*?)\r?\n\x60{3}/s).trim();
            if (!title || !prompt) continue;
            items.push(createPrompt(source, title, prompt, tags, { coverUrl: pickCover(source.rawBase, block) }));
        }
    }
    return items;
}

async function buildAwesomeGpt4oImagePrompts(source) {
    const markdown = await fetchText(source.rawBase, "README.zh-CN.md");
    const items = [];
    for (const block of splitBeforeHeading(markdown, "### ")) {
        const title = firstMatch(block, /^###\s+(.+)$/m).trim();
        const prompt = firstMatch(block, /- \*\*提示词文本：\*\*\s*\x60(.*?)\x60/s).trim();
        if (!title || !prompt) continue;
        items.push(createPrompt(source, title, prompt, ["gpt4o"], { coverUrl: pickCover(source.rawBase, block) }));
    }
    return items;
}

async function buildYouMindPrompts(source) {
    const markdown = await fetchText(source.rawBase, "README_zh.md");
    const items = [];
    for (const block of splitBeforeHeading(markdown, "### ")) {
        const title = firstMatch(block, /^###\s+No\.\s*\d+:\s*(.+)$/m).trim();
        const prompt = firstMatch(block, /#### .*?提示词\s*\r?\n\s*\x60{3}[\w-]*\r?\n(.*?)\r?\n\x60{3}/s).trim();
        if (!title || !prompt) continue;
        const description = firstMatch(block, /####\s+.*?描述\s*\r?\n(.*?)(?=\r?\n####\s+.*?提示词)/s)
            .replace(/^\s*>\s?/gm, "")
            .trim();
        const upstreamId = firstMatch(block, /[?&]id=(\d+)/i);
        const sourceUrl = firstMatch(block, /-\s*\*\*(?:来源|Source)[:：]\*\*\s*\[[^\]]*]\(([^)]+)\)/i).trim();
        const publishedAt = firstMatch(block, /-\s*\*\*(?:发布时间|Published)[:：]\*\*\s*([^\r\n]+)/i).trim();
        const tags = youMindTags(title);
        if (/featured/i.test(block)) tags.push("精选");
        items.push(
            createPrompt(source, title, prompt, tags, {
                upstreamId,
                coverUrl: pickCover(source.rawBase, block),
                description,
                sourceUrl,
                createdAt: normalizeDate(publishedAt),
                requiresReferenceImage: needsReferenceImage(title + "\n" + prompt),
            }),
        );
    }
    return items;
}

async function buildDavidWuGptImage2Prompts(source) {
    const data = JSON.parse(await fetchText(source.rawBase, "prompts.json"));
    return data
        .map((item, index) => {
            const title = (item.title_cn || item.title_en || "").trim();
            const prompt = (item.prompt || "").trim();
            if (!title || !prompt) return null;
            const sourceUrl = String(item.source || "").trim();
            return createPrompt(source, title, prompt, davidWuTags(item), {
                upstreamId: item.id || index + 1,
                coverUrl: absoluteImage(source.rawBase, item.image || ""),
                description: String(item.note || "").trim(),
                sourceUrl: /^https?:\/\//i.test(sourceUrl) ? sourceUrl : "",
                requiresReferenceImage: item.needs_ref === true,
            });
        })
        .filter(Boolean);
}

async function buildFreestyleflyGptImage2Prompts(source) {
    const data = JSON.parse(await fetchText(source.rawBase, "data/cases.json"));
    const cases = Array.isArray(data.cases) ? data.cases : [];
    return cases
        .map((item, index) => {
            const title = String(item.title || "").trim();
            const prompt = String(item.prompt || "").trim();
            if (!title || !prompt) return null;
            const imageAlt = String(item.imageAlt || "").trim();
            const sourceUrl = [item.sourceUrl, item.githubUrl].map((value) => String(value || "").trim()).find((value) => /^https?:\/\//i.test(value));
            const tags = [...(Array.isArray(item.styles) ? item.styles : []), ...(Array.isArray(item.scenes) ? item.scenes : [])].filter((value) => typeof value === "string");
            if (item.featured === true) tags.push("精选");
            return createPrompt(source, title, prompt, tags, {
                upstreamId: item.id || index + 1,
                coverUrl: absoluteImage(source.rawBase + "/data", String(item.image || "")),
                description: imageAlt && imageAlt !== title ? imageAlt : "",
                sourceUrl: sourceUrl || "",
                category: freestyleflyCategoryAliases.get(item.category) || "",
                requiresReferenceImage: needsReferenceImage(title + "\n" + prompt),
            });
        })
        .filter(Boolean);
}

function createPrompt(source, title, prompt, tags, options = {}) {
    const normalizedTags = normalizePromptTags(tags);
    const category = options.category || promptCategory(title, normalizedTags);
    const filteredTags = normalizedTags.filter((tag) => tag !== category).slice(0, 5);
    return {
        id: stablePromptId(source.category, prompt, options.upstreamId),
        title,
        coverUrl: options.coverUrl || "",
        prompt,
        description: options.description || "",
        tags: filteredTags.length ? filteredTags : ["其他"],
        category,
        model: source.model,
        requiresReferenceImage: Boolean(options.requiresReferenceImage),
        source: source.label,
        sourceId: source.category,
        githubUrl: source.githubUrl,
        sourceUrl: options.sourceUrl || "",
        license: source.license,
        licenseUrl: source.licenseUrl,
        createdAt: options.createdAt || "",
        updatedAt: "",
    };
}

function stablePromptId(sourceId, prompt, upstreamId) {
    const rawSuffix = upstreamId === undefined || upstreamId === null || upstreamId === "" ? hashText(normalizePromptBody(prompt)).slice(0, 16) : String(upstreamId);
    const suffix = rawSuffix
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return sourceId + "-" + (suffix || hashText(normalizePromptBody(prompt)).slice(0, 16));
}

function deduplicatePrompts(items) {
    const seen = new Set();
    return items.filter((item) => {
        const key = normalizePromptBody(item.prompt);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function hashText(value) {
    return createHash("sha256").update(value).digest("hex");
}

async function fetchText(baseUrl, file) {
    const response = await fetchWithRetry(baseUrl + "/" + file);
    return response.text();
}

async function fetchWithRetry(url) {
    let error;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            const response = await fetch(url, { headers: { "user-agent": "lingweave-prompt-sync" }, signal: AbortSignal.timeout(60_000) });
            if (!response.ok) throw new Error(response.status + " " + response.statusText);
            return response;
        } catch (nextError) {
            error = nextError;
            if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 800));
        }
    }
    throw new Error("下载失败：" + url + "\n" + (error instanceof Error ? error.message : String(error)));
}

function splitBeforeHeading(markdown, prefix) {
    const blocks = [];
    let current = [];
    for (const line of markdown.split("\n")) {
        if (line.startsWith(prefix) && current.length) {
            blocks.push(current.join("\n"));
            current = [];
        }
        current.push(line);
    }
    blocks.push(current.join("\n"));
    return blocks;
}

function firstMatch(value, pattern) {
    return pattern.exec(value)?.[1] || "";
}

function pickCover(baseUrl, markdown) {
    return extractImages(baseUrl, markdown).find((url) => !isDecorationImage(url)) || "";
}

function extractImages(baseUrl, value) {
    const markdownImages = Array.from(value.matchAll(/!\[[^\]]*]\(([^)]+)\)/g), (match) => match[1]);
    const htmlImages = Array.from(value.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi), (match) => match[1]);
    return [...markdownImages, ...htmlImages].map((image) => absoluteImage(baseUrl, image.replaceAll("&amp;", "&"))).filter(Boolean);
}

function isDecorationImage(value) {
    return /(?:awesome\.re\/badge|img\.shields\.io|api\.star-history\.com|actions\/workflows\/.+\/badge|atomgit\.com\/.+\/badge)/i.test(value);
}

function absoluteImage(baseUrl, image) {
    if (!image) return "";
    if (/^https?:\/\//i.test(image)) return image;
    return baseUrl + "/" + image.replace(/^\.?\//, "");
}

function tagsFromHeading(heading) {
    return splitTags(heading.replace(/[^\p{L}\p{N}/&、与 ]/gu, ""), /\s*(?:\/|&|、|与)\s*/);
}

function youMindTags(title) {
    const [, prefix] = title.match(/^(.+?) - /) || [];
    return tagsFromHeading(prefix || "");
}

function davidWuTags(item) {
    return splitTags([item.category_cn, item.category].filter(Boolean).join("/"), /\//);
}

function normalizePromptTags(tags) {
    const normalized = [];
    for (const rawTag of tags) {
        const value = rawTag
            .trim()
            .toLowerCase()
            .replace(/^(?:图像|视频)模板\s*-\s*/, "");
        if (!value || value.startsWith("@") || /(?:gpt|nano.?banana|awesome|awsome)/i.test(value)) continue;
        const alias = tagAliases.get(value);
        if (!alias && /^[a-z0-9_. -]+(?:\(sora\))?$/i.test(value)) continue;
        normalized.push(alias || rawTag.trim().replace(/^(?:图像|视频)模板\s*-\s*/, ""));
    }
    return Array.from(new Set(normalized));
}

function promptCategory(title, tags) {
    const value = [title, ...tags].join(" ").toLowerCase();
    const rules = [
        ["信息图", /(信息图|infographic|图表|教育视觉)/],
        ["UI设计", /(^|\s)ui(\s|$)|ui设计|界面|网页设计|网站设计|app设计/],
        ["图像编辑", /(图像编辑|风格迁移|修复|替换|一致性|局部修改|照片编辑)/],
        ["人物头像", /(人物肖像|头像|人像|portrait|profile|证件照)/],
        ["社交媒体", /(社交媒体|小红书|instagram|youtube|缩略图|社交帖子)/],
        ["影视分镜", /(故事板|分镜|漫画|电影感|影视|动漫改编|游戏科幻|武侠历史|舞蹈动作|奇幻特效)/],
        ["产品电商", /(产品|电商|商品|包装|美食摄影|product)/],
        ["品牌营销", /(品牌|营销|广告|logo|标志设计)/],
        ["海报设计", /(海报|poster|封面|banner)/],
        ["插画艺术", /(插画|动漫|艺术|3d|手办|潮玩|illustration)/],
    ];
    return rules.find(([, pattern]) => pattern.test(value))?.[0] || "其他";
}

function splitTags(value, pattern) {
    return value
        .split(pattern)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
}

function normalizeDate(value) {
    const match = value.match(/(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})/);
    if (!match) return "";
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toISOString();
}

function needsReferenceImage(value) {
    return /(uploaded|reference (?:image|photo)|input (?:image|photo)|参考图|参考图片|上传(?:的)?(?:图片|照片)|输入图)/i.test(value);
}
