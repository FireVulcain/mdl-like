"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { SettingRow, settingsLink } from "@/components/settings/settings-ui";
import { saveShortcutPreferences } from "@/actions/preferences";
import {
    DEFAULT_PALETTE_SHORTCUTS,
    chordFromEvent,
    chordProblem,
    formatChord,
    isFirefoxOnly,
    serializeChord,
} from "@/lib/shortcuts";

const PROBLEM_TEXT: Record<string, string> = {
    "needs-modifier": "Needs Ctrl (or ⌘) or Alt — a bare key would swallow your typing everywhere.",
    reserved: "The browser keeps this one for itself, so the page would never receive it.",
};

export function ShortcutSettings({ initialShortcuts }: { initialShortcuts: string[] }) {
    const router = useRouter();
    const [shortcuts, setShortcuts] = useState(initialShortcuts);
    const [recording, setRecording] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const recorderRef = useRef<HTMLButtonElement>(null);

    const persist = async (next: string[]) => {
        setShortcuts(next);
        await saveShortcutPreferences(next);
        // The palette reads its chords from the layout, so revalidating alone
        // would leave the new shortcut dead until the next navigation.
        router.refresh();
        toast.success("Shortcut preferences saved");
    };

    const onRecordKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
            setRecording(false);
            setProblem(null);
            return;
        }

        const chord = chordFromEvent(e);
        if (!chord) return; // a modifier on its own — keep waiting

        const serialized = serializeChord(chord);
        const issue = chordProblem(serialized);
        if (issue) {
            setProblem(PROBLEM_TEXT[issue]);
            return;
        }
        if (shortcuts.includes(serialized)) {
            setProblem("That one is already in the list.");
            return;
        }

        setRecording(false);
        setProblem(null);
        void persist([...shortcuts, serialized]);
        recorderRef.current?.blur();
    };

    const isDefault =
        shortcuts.length === DEFAULT_PALETTE_SHORTCUTS.length && shortcuts.every((c, i) => c === DEFAULT_PALETTE_SHORTCUTS[i]);

    return (
        <SettingRow
            label="Command palette keys"
            hint="Opens a search over your watchlist and a jump list for every page. Shortcuts taken from the browser (Ctrl + P for printing, Ctrl + K for the address bar) are claimed back; ones the browser reserves for itself, like Ctrl + T, cannot be and are refused here."
            wide
        >
            <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {shortcuts.map((chord) => (
                        <span key={chord} className="inline-flex h-7 items-center gap-0.5 rounded-md bg-surface-3 pl-2.5 pr-1 font-mono text-xs text-fg-soft">
                            {formatChord(chord)}
                            <button
                                type="button"
                                onClick={() => void persist(shortcuts.filter((c) => c !== chord))}
                                aria-label={`Remove ${formatChord(chord)}`}
                                className="grid size-5 cursor-pointer place-items-center rounded text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                    <button
                        ref={recorderRef}
                        type="button"
                        onClick={() => {
                            setRecording(true);
                            setProblem(null);
                        }}
                        onKeyDown={recording ? onRecordKeyDown : undefined}
                        onBlur={() => setRecording(false)}
                        className={`h-7 cursor-pointer rounded-md px-2.5 text-[13px] transition-colors ${
                            recording ? "bg-surface-2 text-fg ring-1 ring-inset ring-fg-dim" : "bg-surface-2 text-fg-muted hover:text-fg"
                        }`}
                    >
                        {recording ? "Press the keys…" : "Add a shortcut"}
                    </button>
                    {!isDefault && (
                        <button type="button" onClick={() => void persist(DEFAULT_PALETTE_SHORTCUTS)} className={settingsLink}>
                            Reset
                        </button>
                    )}
                </div>
                {problem && <p className="text-xs text-onhold">{problem}</p>}
                {shortcuts.length === 0 && (
                    <p className="text-xs text-fg-dim">No shortcut set; the palette still opens from the button inside the header search field.</p>
                )}
                {shortcuts.some(isFirefoxOnly) && (
                    <p className="text-xs text-fg-dim">
                        Firefox opens a private window on Ctrl + Shift + P before the page sees it, so that one only works in Chrome and
                        Edge. The other shortcuts in this list still do.
                    </p>
                )}
            </div>
        </SettingRow>
    );
}
