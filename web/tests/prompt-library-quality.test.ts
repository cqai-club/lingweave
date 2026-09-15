import { describe, expect, it } from "vitest";

import { promptExclusionReason } from "../scripts/prompt-library-schema.mjs";

describe("提示词库质量过滤", () => {
    it.each([
        ["原文未公开，案例目标是展示个人主页视觉设计。", "unavailable"],
        ["Naruto stickers", "too-simple"],
        ["帮我生成一张 RAG 技术的详细讲解图", "too-simple"],
        ["Redraw this photo in Ghibli style", "too-simple"],
    ])("过滤不可用或信息量过低的提示词", (prompt, reason) => {
        expect(promptExclusionReason(prompt)).toBe(reason);
    });

    it.each(["为 [城市] 生成一张三天旅行指南图像", "生成一张水彩风格的德国地图，并在地图上用圆珠笔标出所有联邦州。", "Transform the characters in the scene into 3D chibi style while keeping the original scene layout and costume styling unchanged."])(
        "保留带变量、多个构图分句或内容完整的提示词",
        (prompt) => {
            expect(promptExclusionReason(prompt)).toBe("");
        },
    );
});
