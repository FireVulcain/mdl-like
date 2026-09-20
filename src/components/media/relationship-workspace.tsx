"use client";

import { useState } from "react";
import type { CharacterMapData } from "@/lib/character-map";
import { CharacterMap } from "./character-map";
import { RelationshipManager } from "./relationship-manager";

/**
 * The relationships page's two halves, over one copy of the chart: the
 * picture, and the list it is drawn from.
 *
 * The chart lives in state here rather than in the page, so a link saved in
 * the list below is in the picture above before the server has answered the
 * refresh — the point of editing beside the thing edited. A server render
 * that brings a newer chart (the refresh landing, a generate run) replaces it.
 */
export function RelationshipWorkspace({
    map: initial,
    mdlSlug,
    mediaId,
    canEdit,
    completed = false,
    progress = null,
}: {
    map: CharacterMapData;
    mdlSlug: string;
    mediaId: string;
    canEdit: boolean;
    completed?: boolean;
    progress?: number | null;
}) {
    // The chart being shown, and the server's own copy beside it: when a new
    // render brings a different one, it wins — the way React adjusts state on
    // a changed prop, without an effect and a second paint.
    const [state, setState] = useState({ server: initial, map: initial });
    if (state.server !== initial) setState({ server: initial, map: initial });
    const map = state.map;
    const setMap = (next: CharacterMapData) => setState((s) => ({ ...s, map: next }));

    // One spoiler door for the page. The twists are the same twists in the
    // picture and in the list, so opening them in either opens both — two
    // pills a scroll apart that disagreed read as a bug.
    const [reveals, setReveals] = useState(completed);

    return (
        <div className="space-y-8">
            <CharacterMap map={map} completed={completed} progress={progress} reveals={reveals} onReveals={setReveals} />
            <div className="h-px bg-linear-to-r from-transparent via-line to-transparent" />
            <RelationshipManager map={map} mdlSlug={mdlSlug} mediaId={mediaId} canEdit={canEdit} reveals={reveals} onReveals={setReveals} onMap={setMap} />
        </div>
    );
}
