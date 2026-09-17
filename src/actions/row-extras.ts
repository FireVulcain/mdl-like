"use server";

import { getRowExtras, type RowExtras } from "@/lib/row-extras";

/**
 * The genres, faces and rank for one card, fetched when its info popover opens.
 * The lead gets them with the page; the other cards in a row only need them if
 * someone asks, so they are not shipped for the ones nobody will.
 */
export async function getCardExtras(slug: string): Promise<RowExtras | null> {
    const found = await getRowExtras([slug]);
    return found.get(slug) ?? null;
}
