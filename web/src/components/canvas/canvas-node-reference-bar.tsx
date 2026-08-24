import { FileText, Image as ImageIcon, Music2, Video, X } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import { getGroupResourceNodes } from "@/lib/canvas/canvas-resource-references";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export function CanvasNodeReferenceBar({ nodeId, nodes, connectedNodes, onDisconnect, onSelectNode }: { nodeId: string; nodes: CanvasNodeData[]; connectedNodes: CanvasNodeData[]; onDisconnect: (fromNodeId: string, toNodeId: string) => void; onSelectNode?: (nodeId: string) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const references = connectedNodes.flatMap((source) => (source.type === CanvasNodeType.Group ? getGroupResourceNodes(source.id, nodes) : [source]).map((node: CanvasNodeData) => ({ node, sourceNodeId: source.id }))).filter((reference, index, list) => list.findIndex((item) => item.node.id === reference.node.id) === index);
    if (!references.length) return null;
    return (
        <div className="mb-2">
            <div className="mb-1 text-[11px] font-medium" style={{ color: theme.node.muted }}>参考内容</div>
            <div className="flex min-h-12 gap-2 overflow-x-auto pb-1">
                {references.map(({ node, sourceNodeId }) => (
                    <div key={`${sourceNodeId}:${node.id}`} className="group relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border" style={{ background: theme.toolbar.activeBg, borderColor: theme.toolbar.border }} title={node.title}>
                        {node.type === CanvasNodeType.Image && node.metadata?.content ? <img src={node.metadata.content} alt={node.title} className="size-full object-cover" /> : node.type === CanvasNodeType.Video && node.metadata?.content ? <video src={node.metadata.content} className="size-full object-cover" muted /> : node.type === CanvasNodeType.Audio ? <Music2 className="size-4 opacity-65" /> : node.type === CanvasNodeType.Text ? <FileText className="size-4 opacity-65" /> : <ImageIcon className="size-4 opacity-65" />}
                        <button type="button" className="absolute inset-0" aria-label={`选择${node.title}`} onClick={() => onSelectNode?.(node.id)} />
                        <button type="button" className="absolute right-0 top-0 grid size-5 place-items-center rounded-full border opacity-0 transition-opacity group-hover:opacity-100" style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }} onClick={() => onDisconnect(sourceNodeId, nodeId)} aria-label="移除参考内容"><X className="size-3" /></button>
                    </div>
                ))}
            </div>
        </div>
    );
}
