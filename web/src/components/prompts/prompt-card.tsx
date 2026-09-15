import { Copy } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Card, Tag } from "antd";

import { formatPromptDate, type Prompt } from "@/services/api/prompts";
import { PromptCover } from "./prompt-cover";

export function PromptCard({
    item,
    onOpen,
    onCopy,
    actionLabel = "复制",
    actionIcon = <Copy className="size-3.5" />,
    actionType = "text",
    extraAction,
}: {
    item: Prompt;
    onOpen: () => void;
    onCopy: () => void;
    actionLabel?: string;
    actionIcon?: ReactNode;
    actionType?: "text" | "primary";
    extraAction?: ReactNode;
}) {
    const cardTags = [item.category, ...item.tags.filter((tag) => tag !== item.category)].slice(0, 3);
    const hiddenTagCount = Math.max(0, new Set([item.category, ...item.tags]).size - cardTags.length);
    const promptDate = formatPromptDate(item.updatedAt || item.createdAt);

    return (
        <Card hoverable className="group h-full overflow-hidden border-border/70 bg-card [&_.ant-card-body]:h-full" styles={{ body: { padding: 0 } }}>
            <div className="flex h-full flex-col">
                <button type="button" className="block w-full overflow-hidden bg-muted text-left" aria-label={"查看“" + item.title + "”详情"} onClick={onOpen}>
                    <PromptCover src={item.coverUrl} alt={item.title + " 效果图"} className="aspect-video w-full object-contain" />
                </button>
                <div className="flex flex-1 flex-col p-4">
                    <button type="button" className="flex flex-1 flex-col text-left" onClick={onOpen}>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Tag variant="filled" color="blue" className="m-0 text-[11px]">
                                {item.model}
                            </Tag>
                            {item.requiresReferenceImage ? (
                                <Tag variant="filled" color="gold" className="m-0 text-[11px]">
                                    需要参考图
                                </Tag>
                            ) : null}
                        </div>
                        <h2 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-foreground">{item.title}</h2>
                        {item.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</p> : null}
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-foreground/80">{item.prompt}</p>
                        <div className="mt-4 flex flex-wrap gap-1.5">
                            {cardTags.map((tag) => (
                                <Tag key={tag} className="m-0 text-[11px]">
                                    {tag}
                                </Tag>
                            ))}
                            {hiddenTagCount ? <Tag className="m-0 text-[11px]">+{hiddenTagCount}</Tag> : null}
                        </div>
                    </button>
                    <div className="mt-4 border-t border-border/70 pt-3">
                        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span className="min-w-0 truncate" title={item.source}>
                                {item.source}
                            </span>
                            {promptDate ? <span className="shrink-0">{promptDate}</span> : null}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button block={actionType === "primary"} type={actionType} size="small" icon={actionIcon} onClick={onCopy}>
                                {actionLabel}
                            </Button>
                            {extraAction}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
