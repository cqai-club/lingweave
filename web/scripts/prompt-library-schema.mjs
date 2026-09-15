import { createHash } from "node:crypto";

export const PROMPT_LIBRARY_SCHEMA_VERSION = 2;
export const PROMPT_LIBRARY_MIN_ITEMS = 700;
export const PROMPT_LIBRARY_MAX_ITEMS = 2_000;

const unsupportedImageFields = ["imageUrl", "sourceImageUrl", "sourceMedia"];
const minimumCoverRatio = 0.9;
const unavailablePromptPattern = /原文未公开|prompt (?:not|isn't) (?:available|provided)|未提供.{0,8}提示词|提示词.{0,8}未公开/i;
const promptPlaceholderPattern = /\[[^\]]{1,100}\]|\{[^}]{1,100}\}|<[^>]{1,100}>|(?:^|[^A-Za-z])X{2,}(?:[^A-Za-z]|$)|_{3,}|\$\{?\w+\}?/i;

export function normalizePromptBody(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ");
}

export function promptExclusionReason(value) {
    const rawPrompt = String(value || "").trim();
    const prompt = normalizePromptBody(rawPrompt);
    if (unavailablePromptPattern.test(prompt)) return "unavailable";
    if (promptPlaceholderPattern.test(prompt)) return "";

    const sentenceCount = rawPrompt.split(/[.!?。！？；;\n]+/).filter((part) => part.trim()).length;
    const clauseCount = prompt.split(/[,，:：;；.!?。！？]+/).filter((part) => part.trim()).length;
    const cjkCount = (prompt.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) || []).length;
    const latinWordCount = (prompt.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
    const isShort = cjkCount ? cjkCount + latinWordCount <= 20 : latinWordCount <= 8;
    return sentenceCount === 1 && clauseCount === 1 && isShort ? "too-simple" : "";
}

export function promptItemsChecksum(items) {
    const records = items.map((item) => {
        const record = item && typeof item === "object" ? item : {};
        return [
            record.id,
            record.title,
            record.coverUrl,
            record.prompt,
            record.description,
            record.tags,
            record.category,
            record.model,
            record.requiresReferenceImage,
            record.source,
            record.sourceId,
            record.githubUrl,
            record.sourceUrl,
            record.license,
            record.licenseUrl,
            record.createdAt,
            record.updatedAt,
        ];
    });
    return createHash("sha256").update(JSON.stringify(records)).digest("hex");
}

export function validatePromptLibrary(library, { minItems = PROMPT_LIBRARY_MIN_ITEMS, maxItems = PROMPT_LIBRARY_MAX_ITEMS } = {}) {
    const errors = [];
    const items = Array.isArray(library?.items) ? library.items : [];
    const sources = Array.isArray(library?.sources) ? library.sources : [];

    if (library?.schemaVersion !== PROMPT_LIBRARY_SCHEMA_VERSION) errors.push("schemaVersion 必须为 " + PROMPT_LIBRARY_SCHEMA_VERSION);
    if (!Number.isFinite(Date.parse(library?.syncedAt || ""))) errors.push("syncedAt 无效");
    if (items.length < minItems || items.length > maxItems) errors.push("提示词数量 " + items.length + " 超出 " + minItems + "～" + maxItems + " 的精选库范围");
    if (library?.total !== items.length) errors.push("total 与 items 数量不一致");
    if (!sources.length) errors.push("sources 不能为空");

    const ids = new Set();
    const promptBodies = new Set();
    let coverCount = 0;
    for (const [index, item] of items.entries()) {
        const prefix = "items[" + index + "]";
        const record = item && typeof item === "object" ? item : {};
        for (const field of ["id", "title", "prompt", "category", "model", "source", "sourceId", "githubUrl", "license"]) {
            if (typeof record[field] !== "string" || !record[field].trim()) errors.push(prefix + "." + field + " 不能为空");
        }
        const exclusionReason = promptExclusionReason(record.prompt);
        if (exclusionReason) errors.push(prefix + ".prompt 应被质量过滤：" + exclusionReason);
        if (!Array.isArray(record.tags) || record.tags.some((tag) => typeof tag !== "string")) {
            errors.push(prefix + ".tags 必须为字符串数组");
        } else if (!record.tags.length) {
            errors.push(prefix + ".tags 不能为空，无明确标签时应使用“其他”");
        }
        if (typeof record.requiresReferenceImage !== "boolean") errors.push(prefix + ".requiresReferenceImage 必须为布尔值");
        if (typeof record.coverUrl !== "string") {
            errors.push(prefix + ".coverUrl 必须为字符串");
        } else if (record.coverUrl) {
            if (!/^https?:\/\//i.test(record.coverUrl)) errors.push(prefix + ".coverUrl 必须为 HTTP(S) 地址");
            coverCount += 1;
        }
        if (ids.has(record.id)) errors.push("存在重复 ID：" + record.id);
        ids.add(record.id);
        const body = normalizePromptBody(record.prompt);
        if (promptBodies.has(body)) errors.push("存在重复提示词正文：" + record.id);
        promptBodies.add(body);
        for (const field of unsupportedImageFields) {
            if (field in record) errors.push(prefix + " 不应包含图片字段 " + field);
        }
    }
    if (items.length && coverCount < Math.ceil(items.length * minimumCoverRatio)) errors.push("效果图覆盖率不足 90%：" + coverCount + "/" + items.length);

    let sourceTotal = 0;
    for (const source of sources) {
        const sourceRecord = source && typeof source === "object" ? source : {};
        const sourceItems = items.filter((item) => item && typeof item === "object" && item.sourceId === sourceRecord.id);
        sourceTotal += sourceItems.length;
        for (const field of ["id", "label", "githubUrl", "license", "model", "checksum"]) {
            if (typeof sourceRecord[field] !== "string" || !sourceRecord[field].trim()) errors.push("来源元数据 " + (sourceRecord.id || "unknown") + "." + field + " 不能为空");
        }
        if (sourceRecord.itemCount !== sourceItems.length) errors.push("来源 " + sourceRecord.id + " 的 itemCount 不一致");
        if (sourceRecord.checksum !== promptItemsChecksum(sourceItems)) errors.push("来源 " + sourceRecord.id + " 的 checksum 不一致");
    }
    if (sourceTotal !== items.length) errors.push("来源数量合计与 items 数量不一致");
    if (library?.checksum !== promptItemsChecksum(items)) errors.push("提示词库 checksum 不一致");

    return errors;
}

export function assertPromptLibrary(library, options) {
    const errors = validatePromptLibrary(library, options);
    if (errors.length) throw new Error("提示词库校验失败：\n- " + errors.slice(0, 20).join("\n- "));
}
