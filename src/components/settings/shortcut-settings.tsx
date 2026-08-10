"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, RotateCcw, X } from "lucide-react";
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
        <div className="divide-y divide-white/8">
            <div className="space-y-3 py-5 first:pt-0 last:pb-0">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Command palette</h3>

                <div className="flex flex-wrap items-center gap-2">
                    {shortcuts.map((chord) => (
                        <span
                            key={chord}
                            className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-lg bg-white/5 text-sm font-medium text-white"
                        >
                            {formatChord(chord)}
                            <button
                                onClick={() => void persist(shortcuts.filter((c) => c !== chord))}
                                aria-label={`Remove ${formatChord(chord)}`}
                                className="p-0.5 rounded text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </span>
                    ))}

                    <button
                        ref={recorderRef}
                        onClick={() => {
                            setRecording(true);
                            setProblem(null);
                        }}
                        onKeyDown={recording ? onRecordKeyDown : undefined}
                        onBlur={() => setRecording(false)}
                        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                            recording
                                ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        {recording ? (
                            "Press a shortcut…"
                        ) : (
                            <>
                                <Plus className="h-3.5 w-3.5" />
                                Add
                            </>
                        )}
                    </button>

                    {!isDefault && (
                        <button
                            onClick={() => void persist(DEFAULT_PALETTE_SHORTCUTS)}
                            className="inline-flex items-center gap-1.5 h-8 px-2 rounded-lg text-xs text-gray-600 hover:text-white transition-colors cursor-pointer"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset
                        </button>
                    )}
                </div>

                {problem && <p className="text-xs text-amber-400/80">{problem}</p>}

                {shortcuts.length === 0 && (
                    <p className="text-xs text-gray-600">
                        No shortcut set — the palette still opens from the button inside the header search field.
                    </p>
                )}

                {shortcuts.some(isFirefoxOnly) && (
                    <p className="text-xs text-gray-600">
                        Firefox opens a private window on Ctrl + Shift + P before the page sees it, so that one only works
                        in Chrome and Edge. The other shortcuts in this list still do.
                    </p>
                )}

                <p className="text-xs text-gray-600">
                    Opens a search over your watchlist and a jump list for every page. Shortcuts taken from the browser —
                    Ctrl + P for printing, Ctrl + K for the address bar — are claimed back; ones the browser reserves for
                    itself, like Ctrl + T, cannot be and are refused here.
                </p>
            </div>
        </div>
    );
}
