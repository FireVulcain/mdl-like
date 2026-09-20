"use server";

import * as fs from "fs";
import * as path from "path";
import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { saveChart } from "@/lib/character-map-generate";
import type { CharacterMapData, MapLink } from "@/lib/character-map";
import { draftFrom, fingerprint, validateDraft, withLink, withoutLink } from "@/lib/character-map-links";

/**
 * Writing one relationship of a chart, from the editor under the chart page.
 *
 * Admin only — the same check the generate route makes, and the one that
 * matters: the editor is not rendered for anyone else, but this is the guard.
 * One link at a time, by its index, with a fingerprint of the link the editor
 * believed was there: a chart rewritten in between (a generate run, a second
 * tab) refuses the write rather than landing on another link.
 *
 * The chart is read from the JSON file in development and from the row
 * everywhere else, the way the stills route reads it — Postgres hands jsonb
 * keys back in its own order, and a chart that went through the row and back
 * would rewrite every line of its file for one changed link. It goes back
 * through `saveChart`, which writes the row and the file together.
 */

export type LinkResult = { ok: true; map: CharacterMapData } | { ok: false; error: string };

const CHARTS = () => path.join(process.cwd(), "prisma", "character-maps");

async function readChart(mdlSlug: string): Promise<{ map: CharacterMapData; source: string } | null> {
    if (!/^[0-9]+-[a-z0-9-]+$/.test(mdlSlug)) return null;
    const row = await prisma.characterMap.findUnique({ where: { mdlSlug } });
    const file = path.join(CHARTS(), `${mdlSlug}.json`);
    if (process.env.NODE_ENV !== "production" && fs.existsSync(file)) {
        try {
            return { map: JSON.parse(fs.readFileSync(file, "utf-8")) as CharacterMapData, source: row?.source ?? "session" };
        } catch {
            /* a half-written file: fall through to the row */
        }
    }
    return row ? { map: row.dataJson as unknown as CharacterMapData, source: row.source } : null;
}

/** Both pages that draw the chart, so the next reader gets the new one. */
function revalidateMedia(mediaId: string) {
    if (!/^[a-z]+-[a-zA-Z0-9_-]+$/.test(mediaId)) return;
    revalidatePath(`/media/${mediaId}`);
    revalidatePath(`/media/${mediaId}/relationships`);
}

type SaveInput = {
    mdlSlug: string;
    mediaId: string;
    /** the link to replace, or null to add one */
    index: number | null;
    /** what the editor read at that index, for an edit */
    expect: string | null;
    link: MapLink;
};

export async function saveRelationship({ mdlSlug, mediaId, index, expect, link }: SaveInput): Promise<LinkResult> {
    if (!(await isAdminUser())) return { ok: false, error: "Only the admin can edit relationships." };
    const chart = await readChart(mdlSlug);
    if (!chart) return { ok: false, error: "No chart for this entry." };

    if (index != null) {
        const current = chart.map.links[index];
        if (!current) return { ok: false, error: "That relationship is no longer there — reload the page." };
        if (expect && fingerprint(current) !== expect) return { ok: false, error: "The chart changed while you were editing — reload the page." };
    }

    const errors = validateDraft(draftFrom(link), chart.map);
    const first = Object.values(errors)[0];
    if (first) return { ok: false, error: first };

    const next = withLink(chart.map, index, link);
    await saveChart(next, chart.source);
    revalidateMedia(mediaId);
    return { ok: true, map: next };
}

export async function deleteRelationship({ mdlSlug, mediaId, index, expect }: { mdlSlug: string; mediaId: string; index: number; expect: string }): Promise<LinkResult> {
    if (!(await isAdminUser())) return { ok: false, error: "Only the admin can edit relationships." };
    const chart = await readChart(mdlSlug);
    if (!chart) return { ok: false, error: "No chart for this entry." };

    const current = chart.map.links[index];
    if (!current) return { ok: false, error: "That relationship is no longer there — reload the page." };
    if (fingerprint(current) !== expect) return { ok: false, error: "The chart changed while you were editing — reload the page." };

    const next = withoutLink(chart.map, index);
    await saveChart(next, chart.source);
    revalidateMedia(mediaId);
    return { ok: true, map: next };
}
