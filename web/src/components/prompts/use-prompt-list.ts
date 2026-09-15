import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { ALL_PROMPTS_OPTION, fetchPrompts } from "@/services/api/prompts";

export const PROMPT_PAGE_SIZE = 20;

export function usePromptList({ keyword, tag, category, enabled = true }: { keyword: string; tag: string; category: string; enabled?: boolean }) {
    const query = useInfiniteQuery({
        queryKey: ["prompts", keyword, tag, category],
        queryFn: ({ pageParam }) => fetchPrompts({ keyword, tag: tag === ALL_PROMPTS_OPTION ? [] : [tag], category, page: pageParam, pageSize: PROMPT_PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage, pages) => (pages.reduce((total, page) => total + page.items.length, 0) < lastPage.total ? pages.length + 1 : undefined),
        placeholderData: (previousData) => previousData,
        enabled,
    });
    const firstPage = query.data?.pages[0];
    return {
        query,
        items: useMemo(() => query.data?.pages.flatMap((page) => page.items) || [], [query.data?.pages]),
        tags: firstPage?.tags || [],
        categories: useMemo(() => [ALL_PROMPTS_OPTION, ...(firstPage?.categories || [])], [firstPage?.categories]),
        total: firstPage?.total || 0,
        library: firstPage?.library || null,
    };
}
