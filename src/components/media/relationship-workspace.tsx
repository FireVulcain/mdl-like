"use client";

import { useMemo, useState } from "react";
import { episodeStops, initialStop, type CharacterMapData, type StoryView } from "@/lib/character-map";
import { rememberReveals } from "@/actions/character-map-view";
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
    openedBefore = null,
}: {
    map: CharacterMapData;
    mdlSlug: string;
    mediaId: string;
    canEdit: boolean;
    completed?: boolean;
    progress?: number | null;
    /** the spoiler door as this reader last left it on this chart, or null */
    openedBefore?: boolean | null;
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
    // pills a scroll apart that disagreed read as a bug. It opens where the
    // reader last left it, or, the first time, by whether they have
    // finished the show; working it is remembered against their account, so
    // it survives the page and the machine.
    const [reveals, setReveals] = useState(openedBefore ?? completed);
    const changeReveals = (next: boolean) => {
        setReveals(next);
        void rememberReveals(mdlSlug, next);
    };

    // And one place in the story: the chart's slider and the list's select
    // are two handles on it. A dated chart opens as of the last stop the
    // reader has passed; an undated one has only the "Everyone" view.
    const stops = useMemo(() => episodeStops(map), [map]);
    const [story, setStory] = useState<StoryView>(() => ({ byEpisode: stops.length > 0, stop: initialStop(stops, completed, progress) }));

    return (
        <div className="space-y-8">
            <CharacterMap map={map} completed={completed} progress={progress} reveals={reveals} onReveals={changeReveals} story={story} onStory={setStory} />
            <div className="h-px bg-linear-to-r from-transparent via-line to-transparent" />
            <RelationshipManager map={map} mdlSlug={mdlSlug} mediaId={mediaId} canEdit={canEdit} reveals={reveals} onReveals={changeReveals} stops={stops} story={story} onStory={setStory} onMap={setMap} />
        </div>
    );
}
