"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { episodeStops, initialStop, type CharacterMapData, type MapPerson } from "@/lib/character-map";
import { draftFromPerson, emptyPersonDraft, personFingerprint, type PersonDraft } from "@/lib/character-map-people";
import { rememberReveals } from "@/actions/character-map-view";
import { deletePerson, savePerson, type LinkResult } from "@/actions/character-map-links";
import { CharacterMap } from "./character-map";
import { PersonEditor } from "./person-editor";
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
    // reader has passed; an undated one has no stops and shows everything.
    const stops = useMemo(() => episodeStops(map), [map]);
    const [stop, setStop] = useState(() => initialStop(stops, completed, progress));

    // The link picked in the chart is marked in the list, and "Edit in the
    // list" on its panel asks the list to scroll there and open it — a
    // request stamped with a time, so asking twice for the same link works.
    const [picked, setPicked] = useState<number | null>(null);
    const [editRequest, setEditRequest] = useState<{ index: number; at: number } | null>(null);

    // The characters, written here rather than in the list: a new one is
    // asked for from the list, an existing one from their panel in the chart.
    const router = useRouter();
    const [personEdit, setPersonEdit] = useState<{ person: MapPerson | null; expect: string | null; draft: PersonDraft } | null>(null);
    const [personSaving, setPersonSaving] = useState(false);
    const [personError, setPersonError] = useState<string | null>(null);
    const openPerson = (id: string | null) => {
        const person = id == null ? null : (map.people.find((p) => p.id === id) ?? null);
        if (id != null && !person) return;
        setPersonError(null);
        setPersonEdit({ person, expect: person ? personFingerprint(person) : null, draft: person ? draftFromPerson(person) : emptyPersonDraft() });
    };
    const writePerson = async (write: () => Promise<LinkResult>) => {
        setPersonSaving(true);
        setPersonError(null);
        try {
            const res = await write();
            if (!res.ok) {
                setPersonError(res.error);
                return;
            }
            setMap(res.map);
            setPersonEdit(null);
            router.refresh();
        } catch {
            setPersonError("The save did not go through.");
        } finally {
            setPersonSaving(false);
        }
    };

    return (
        <div className="space-y-8">
            <CharacterMap
                map={map}
                completed={completed}
                progress={progress}
                reveals={reveals}
                onReveals={changeReveals}
                stop={stop}
                onStop={setStop}
                onPickLink={setPicked}
                onEditLink={canEdit ? (index) => setEditRequest({ index, at: Date.now() }) : undefined}
                onEditPerson={canEdit ? openPerson : undefined}
            />
            <div className="h-px bg-linear-to-r from-transparent via-line to-transparent" />
            <RelationshipManager
                map={map}
                mdlSlug={mdlSlug}
                mediaId={mediaId}
                canEdit={canEdit}
                reveals={reveals}
                onReveals={changeReveals}
                stops={stops}
                stop={stop}
                onStop={setStop}
                onMap={setMap}
                highlight={picked}
                editRequest={editRequest}
                onAddPerson={canEdit ? () => openPerson(null) : undefined}
            />
            {personEdit && (
                <PersonEditor
                    key={personEdit.person?.id ?? "new"}
                    map={map}
                    person={personEdit.person}
                    initial={personEdit.draft}
                    saving={personSaving}
                    error={personError}
                    onCancel={() => setPersonEdit(null)}
                    onSave={(draft) => writePerson(() => savePerson({ mdlSlug, mediaId, id: personEdit.person?.id ?? null, expect: personEdit.expect, draft }))}
                    onDelete={personEdit.person && personEdit.expect ? () => writePerson(() => deletePerson({ mdlSlug, mediaId, id: personEdit.person!.id, expect: personEdit.expect! })) : undefined}
                />
            )}
        </div>
    );
}
