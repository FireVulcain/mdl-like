"use server";

import { mediaService } from "@/services/media.service";
import type { UnifiedMedia } from "@/services/media.service";

export async function fetchMdlSearchResults(query: string): Promise<UnifiedMedia[]> {
    return mediaService.searchMdlMedia(query);
}

export async function fetchMoreMedia(query: string, page: number): Promise<{ media: UnifiedMedia[]; totalPages: number }> {
    return mediaService.searchMediaPage(query, page);
}
