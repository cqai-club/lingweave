import { FolderPlus, Search } from "lucide-react";
import { type UIEvent, useDeferredValue, useEffect, useState } from "react";
import { App, Button, Empty, Input, Spin, Tag } from "antd";

import { PromptCard } from "@/components/prompts/prompt-card";
import { PromptTagFilter } from "@/components/prompts/prompt-tag-filter";
import { usePromptList } from "@/components/prompts/use-prompt-list";
import { useCopyText } from "@/hooks/use-copy-text";
import { cn } from "@/lib/utils";
import { ALL_PROMPTS_OPTION, formatPromptDate, type Prompt } from "@/services/api/prompts";
import { useAssetStore } from "@/stores/use-asset-store";
import { PromptDetailDialog } from "./components/prompt-detail-dialog";

export default function PromptsPage() {
    const { message } = App.useApp();
    const [keyword, setKeyword] = useState("");
    const [selectedTag, setSelectedTag] = useState(ALL_PROMPTS_OPTION);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const deferredKeyword = useDeferredValue(keyword);
    const addAsset = useAssetStore((state) => state.addAsset);
    const copyText = useCopyText();
    const { query, items: promptItems, tags: promptTags, categories: promptCategoryOptions, total: totalPrompts, library } = usePromptList({ keyword: deferredKeyword, tag: selectedTag, category: selectedCategory });
    const libraryDate = formatPromptDate(library?.syncedAt || "");

    useEffect(() => {
        if (query.isError) message.error(query.error instanceof Error ? query.error.message : "获取提示词失败");
    }, [message, query.error, query.isError]);

    const savePromptAsset = (item: Prompt) => {
        addAsset({
            kind: "text",
            title: item.title,
            coverUrl: item.coverUrl,
            tags: item.tags,
            source: item.source,
            data: { content: item.prompt },
            metadata: {
                source: "prompt-library",
                promptId: item.id,
                githubUrl: item.githubUrl,
                sourceUrl: item.sourceUrl,
                license: item.license,
                model: item.model,
                requiresReferenceImage: item.requiresReferenceImage,
            },
        });
        message.success("已加入我的素材");
    };

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        if (query.hasNextPage && !query.isFetching && target.scrollTop + target.clientHeight >= target.scrollHeight - 160) void query.fetchNextPage();
    };
    const selectCategory = (category: string) => {
        setSelectedCategory(category);
        setSelectedTag(ALL_PROMPTS_OPTION);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
            <main className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-8 sm:px-8" onScroll={handleListScroll}>
                <div className="mx-auto max-w-7xl">
                    <div className="flex flex-col gap-3 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">PROMPT LIBRARY</p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight">提示词库</h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                {library?.total || totalPrompts} 条图文提示词 · {library?.sources.length || 0} 个开源来源
                                {libraryDate ? " · 更新于 " + libraryDate : ""}
                            </p>
                        </div>
                        <p className="max-w-md text-sm leading-6 text-muted-foreground">按分类和标签筛选，复制后即可用于画布创作。</p>
                    </div>

                    {query.isLoading ? (
                        <div className="flex h-60 items-center justify-center">
                            <Spin />
                        </div>
                    ) : (
                        <>
                            <div className="mt-7 rounded-2xl border border-border bg-card p-5">
                                <Input size="large" className="w-full" prefix={<Search className="size-4 text-muted-foreground" />} value={keyword} placeholder="搜索标题、提示词内容或来源" onChange={(event) => setKeyword(event.target.value)} />
                                <div className="mt-5 grid gap-3">
                                    <FilterRow label="分类" options={promptCategoryOptions} selected={selectedCategory} onSelect={selectCategory} />
                                    <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                                        <div className="pt-2 text-xs font-medium text-muted-foreground">标签</div>
                                        <PromptTagFilter options={promptTags} selected={selectedTag} onChange={setSelectedTag} />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-7 flex items-center justify-between text-xs text-muted-foreground">
                                <span>匹配 {totalPrompts} 条</span>
                                {query.isFetching && !query.isFetchingNextPage ? <span>正在更新结果…</span> : null}
                            </div>
                            <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {promptItems.map((item) => (
                                    <PromptCard
                                        key={item.id}
                                        item={item}
                                        onOpen={() => setSelectedPrompt(item)}
                                        onCopy={() => copyText(item.prompt, "提示词已复制")}
                                        extraAction={
                                            <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => savePromptAsset(item)}>
                                                加入我的素材
                                            </Button>
                                        }
                                    />
                                ))}
                            </div>
                            {promptItems.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到匹配的提示词" className="py-16" /> : null}
                            <div className="mt-6 text-center text-xs text-muted-foreground">{query.isFetchingNextPage ? "加载中..." : query.hasNextPage ? "继续向下滚动加载更多" : promptItems.length > 0 ? "已经到底了" : null}</div>
                        </>
                    )}
                </div>
            </main>

            <PromptDetailDialog prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} onCopy={(value) => copyText(value, "提示词已复制")} onSaveAsset={savePromptAsset} />
        </div>
    );
}

function FilterRow({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (value: string) => void }) {
    return (
        <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
            <div className="pt-2 text-xs font-medium text-muted-foreground">{label}</div>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                    <Tag.CheckableTag key={option} checked={selected === option} className={cn("prompt-filter-tag", selected === option && "is-active")} onChange={() => onSelect(option)}>
                        {option}
                    </Tag.CheckableTag>
                ))}
            </div>
        </div>
    );
}
