"use server";

import { mediaService } from "@/services/media.service";
import type { UnifiedMedia } from "@/services/media.service";
import { enrichMediaRows } from "@/lib/media-rows";

export async function fetchMdlSearchResults(query: string): Promise<UnifiedMedia[]> {
    return enrichMediaRows(await mediaService.searchMdlMedia(query));
}

export async function fetchMoreMedia(query: string, page: number): Promise<{ media: UnifiedMedia[]; totalPages: number }> {
    const { media, totalPages } = await mediaService.searchMediaPage(query, page);
    return { media: await enrichMediaRows(media), totalPages };
}
