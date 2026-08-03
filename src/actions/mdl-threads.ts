"use server";

import { kuryanaGetThreads, kuryanaGetPersonThreads, MdlComment } from "@/lib/kuryana";

// A drama's threads and a person's threads return the same payload from
// different paths, so one action serves both rather than duplicating it.
export type ThreadKind = "media" | "person";

export async function loadMoreComments(
    id: string,
    page: number,
    kind: ThreadKind = "media",
): Promise<{ comments: MdlComment[]; hasMore: boolean }> {
    const result = kind === "person" ? await kuryanaGetPersonThreads(id, page) : await kuryanaGetThreads(id, page);
    return {
        comments: result?.comments ?? [],
        hasMore: result?.has_more ?? false,
    };
}
