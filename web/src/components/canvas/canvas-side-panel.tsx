import { useMemo, useState } from "react";
import { Input } from "antd";
import { ChevronRight, FileText, Group, Image as ImageIcon, Music2, Search, Settings2, Video } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

const icons = { image: ImageIcon, video: Video, audio: Music2, text: FileText, config: Settings2, thinking: Settings2, group: Group } as const;

export function CanvasSidePanel({ nodes, selectedNodeIds, onFocusNode }: { nodes: CanvasNodeData[]; selectedNodeIds: Set<string>; onFocusNode: (id: string) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [keyword, setKeyword] = useState("");
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const filtered = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        if (!query) return nodes;
        const matches = new Set(nodes.filter((node) => `${node.title} ${node.metadata?.content || ""} ${node.metadata?.prompt || ""}`.toLowerCase().includes(query)).map((node) => node.id));
        let changed = true;
        while (changed) {
            changed = false;
            nodes.forEach((node) => {
                if (node.metadata?.groupId && matches.has(node.id) && !matches.has(node.metadata.groupId)) {
                    matches.add(node.metadata.groupId);
                    changed = true;
                }
            });
        }
        return nodes.filter((node) => matches.has(node.id));
    }, [keyword, nodes]);
    const rows = useMemo(() => {
        const rows: Array<{ node: CanvasNodeData; depth: number }> = [];
        const visit = (groupId: string | null, depth: number, seen: Set<string>) => {
            filtered.filter((node) => (node.metadata?.groupId || null) === groupId).forEach((node) => {
                if (seen.has(node.id)) return;
                seen.add(node.id);
                rows.push({ node, depth });
                if (node.type === CanvasNodeType.Group && !collapsedGroups.has(node.id)) visit(node.id, depth + 1, seen);
            });
        };
        visit(null, 0, new Set());
        return rows;
    }, [collapsedGroups, filtered]);
    return (
        <aside className="absolute inset-y-0 left-0 z-[65] flex w-[280px] flex-col border-r shadow-xl" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }} data-canvas-no-zoom>
            <div className="border-b px-3 py-3" style={{ borderColor: theme.toolbar.border }}><div className="mb-2 text-sm font-semibold">画布元素</div><Input size="small" prefix={<Search className="size-3.5" />} allowClear placeholder="搜索节点" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {rows.map(({ node, depth }) => { const Icon = icons[node.type] || FileText; const children = filtered.filter((item) => item.metadata?.groupId === node.id); const collapsed = collapsedGroups.has(node.id); return <div key={node.id} className="mb-1 flex items-center rounded-lg" style={{ marginLeft: depth * 18, background: selectedNodeIds.has(node.id) ? theme.toolbar.activeBg : undefined }}><button type="button" className="grid size-7 shrink-0 place-items-center opacity-60" onClick={() => children.length && setCollapsedGroups((prev) => { const next = new Set(prev); collapsed ? next.delete(node.id) : next.add(node.id); return next; })}>{children.length ? <ChevronRight className={`size-3.5 transition-transform ${collapsed ? "" : "rotate-90"}`} /> : null}</button><button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-1 py-2 text-left" onClick={() => onFocusNode(node.id)}><span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md">{node.type === CanvasNodeType.Image && node.metadata?.content ? <img src={node.metadata.content} alt="" className="size-full object-cover" /> : <Icon className="size-4 opacity-65" />}</span><span className="min-w-0 truncate text-xs">{node.title || "未命名节点"}</span></button></div>; })}
                {!rows.length ? <div className="px-2 py-8 text-center text-xs opacity-50">没有匹配节点</div> : null}
            </div>
        </aside>
    );
}
