"use server";

import { mediaService } from "@/services/media.service";
import type { UnifiedMedia } from "@/services/media.service";

export async function fetchMdlSearchResults(query: string): Promise<UnifiedMedia[]> {
    return mediaService.searchMdlMedia(query);
}
