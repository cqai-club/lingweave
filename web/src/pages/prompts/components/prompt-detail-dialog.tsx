import { Copy, ExternalLink, FolderPlus } from "lucide-react";
import { Button, Modal, Space, Tag } from "antd";

import { PromptCover } from "@/components/prompts/prompt-cover";
import { formatPromptDate, type Prompt } from "@/services/api/prompts";

export function PromptDetailDialog({ prompt, onClose, onCopy, onSaveAsset }: { prompt: Prompt | null; onClose: () => void; onCopy: (prompt: string) => void; onSaveAsset?: (prompt: Prompt) => void }) {
    const promptDate = prompt ? formatPromptDate(prompt.updatedAt || prompt.createdAt) : "";
    const promptDateLabel = prompt?.updatedAt ? "更新" : "发布";
    const sourceUrl = prompt ? prompt.sourceUrl || prompt.githubUrl : "";

    return (
        <Modal title={prompt?.title} open={Boolean(prompt)} onCancel={onClose} footer={null} width={1280}>
            {prompt ? (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
                    <div className="min-w-0">
                        <PromptCover src={prompt.coverUrl} alt={prompt.title + " 效果图"} className="aspect-[4/3] w-full rounded-xl border border-border bg-muted object-contain lg:h-[min(68vh,680px)] lg:aspect-auto" />
                        <p className="mt-2 text-xs text-muted-foreground">效果图由上游来源提供，未做本地裁切或二次处理。</p>
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap gap-1.5">
                            <Tag variant="filled" color="blue" className="m-0">
                                {prompt.model}
                            </Tag>
                            <Tag color="orange" className="m-0">
                                {prompt.category}
                            </Tag>
                            {prompt.requiresReferenceImage ? (
                                <Tag variant="filled" color="gold" className="m-0">
                                    需要参考图
                                </Tag>
                            ) : null}
                            {prompt.tags.map((tag) => (
                                <Tag key={tag} className="m-0">
                                    {tag}
                                </Tag>
                            ))}
                        </div>
                        {prompt.description ? <p className="mt-5 text-sm leading-6 text-muted-foreground">{prompt.description}</p> : null}
                        <div className="mt-5 max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-5 text-sm leading-7 text-foreground">{prompt.prompt}</div>
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                            {sourceUrl ? (
                                <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                                    来源：{prompt.source}
                                    <ExternalLink className="size-3" />
                                </a>
                            ) : (
                                <span>来源：{prompt.source}</span>
                            )}
                            {prompt.licenseUrl ? (
                                <a href={prompt.licenseUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                                    许可：{prompt.license}
                                    <ExternalLink className="size-3" />
                                </a>
                            ) : (
                                <span>许可：{prompt.license}</span>
                            )}
                            {promptDate ? (
                                <span>
                                    {promptDateLabel}：{promptDate}
                                </span>
                            ) : null}
                        </div>
                        <Space wrap className="mt-6">
                            <Button type="primary" icon={<Copy className="size-4" />} onClick={() => onCopy(prompt.prompt)}>
                                复制提示词
                            </Button>
                            {onSaveAsset ? (
                                <Button icon={<FolderPlus className="size-4" />} onClick={() => onSaveAsset(prompt)}>
                                    加入我的素材
                                </Button>
                            ) : null}
                        </Space>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
}
