import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function PromptCover({ src, alt, className }: { src: string; alt: string; className?: string }) {
    const [failed, setFailed] = useState(!src);

    useEffect(() => setFailed(!src), [src]);

    if (failed) {
        return (
            <div className={cn("flex flex-col items-center justify-center gap-2 bg-muted text-xs text-muted-foreground", className)}>
                <ImageOff className="size-7" />
                <span>暂无效果图</span>
            </div>
        );
    }

    return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} className={className} onError={() => setFailed(true)} />;
}
