"use server";

import { kuryanaGetThreads, MdlComment } from "@/lib/kuryana";

export async function loadMoreComments(mdlId: string, page: number): Promise<{ comments: MdlComment[]; hasMore: boolean }> {
    const result = await kuryanaGetThreads(mdlId, page);
    return {
        comments: result?.comments ?? [],
        hasMore: result?.has_more ?? false,
    };
}
