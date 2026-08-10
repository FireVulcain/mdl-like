// Keyboard chords, stored as strings like "ctrl+shift+p".
//
// Modifiers are normalized to a fixed order so two spellings of the same chord
// compare equal, and "mod" is deliberately absent: ctrl and meta are treated as
// interchangeable at match time, so one stored chord works on both Windows and
// macOS without the user having to record it twice.

export const DEFAULT_PALETTE_SHORTCUTS = ["ctrl+k", "ctrl+p", "ctrl+shift+p"];

export type Chord = { ctrl: boolean; shift: boolean; alt: boolean; key: string };

export function parseChord(raw: string): Chord | null {
    const parts = raw.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    const chord: Chord = { ctrl: false, shift: false, alt: false, key: "" };
    for (const part of parts) {
        if (part === "ctrl" || part === "cmd" || part === "meta") chord.ctrl = true;
        else if (part === "shift") chord.shift = true;
        else if (part === "alt" || part === "option") chord.alt = true;
        else chord.key = part;
    }
    return chord.key ? chord : null;
}

export function serializeChord(chord: Chord): string {
    const parts: string[] = [];
    if (chord.ctrl) parts.push("ctrl");
    if (chord.alt) parts.push("alt");
    if (chord.shift) parts.push("shift");
    parts.push(chord.key);
    return parts.join("+");
}

/** Human-readable, for buttons and hints: "ctrl+shift+p" → "Ctrl + Shift + P". */
export function formatChord(raw: string): string {
    const chord = parseChord(raw);
    if (!chord) return raw;
    const parts: string[] = [];
    if (chord.ctrl) parts.push("Ctrl");
    if (chord.alt) parts.push("Alt");
    if (chord.shift) parts.push("Shift");
    parts.push(chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
    return parts.join(" + ");
}

export function chordFromEvent(e: KeyboardEvent | React.KeyboardEvent): Chord | null {
    const key = e.key;
    // A modifier pressed on its own is not a chord yet — the recorder keeps
    // waiting rather than storing "ctrl+control".
    if (key === "Control" || key === "Meta" || key === "Shift" || key === "Alt") return null;
    return {
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
        key: key.length === 1 ? key.toLowerCase() : key,
    };
}

export function matchesChord(e: KeyboardEvent, raw: string): boolean {
    const chord = parseChord(raw);
    if (!chord) return false;
    const pressed = chordFromEvent(e);
    if (!pressed) return false;
    // Shift changes the character a key produces ("shift+/" arrives as "?"), so
    // the comparison is on the physical key rather than e.key when shift is held.
    const pressedKey = chord.shift && e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : pressed.key;
    return pressed.ctrl === chord.ctrl && pressed.shift === chord.shift && pressed.alt === chord.alt && pressedKey === chord.key;
}

/**
 * Chords the browser keeps for itself. A page never receives these, so letting
 * one be recorded would produce a shortcut that silently does nothing.
 */
const RESERVED = new Set([
    "ctrl+t",
    "ctrl+n",
    "ctrl+w",
    "ctrl+q",
    "ctrl+shift+t",
    "ctrl+shift+n",
    "ctrl+shift+w",
    "ctrl+shift+q",
    "ctrl+tab",
    "ctrl+shift+tab",
    "f5",
    "f11",
    "f12",
]);

export type ChordProblem = "needs-modifier" | "reserved" | null;

export function chordProblem(raw: string): ChordProblem {
    const chord = parseChord(raw);
    if (!chord) return "needs-modifier";
    // Shift alone is not a modifier for this purpose: "shift+k" is just a
    // capital K, and claiming it would swallow typing everywhere on the site.
    if (!chord.ctrl && !chord.alt && !raw.startsWith("f")) return "needs-modifier";
    if (RESERVED.has(serializeChord(chord))) return "reserved";
    return null;
}

/** Firefox hands Ctrl+Shift+P to its private-window command before any page sees it. */
export function isFirefoxOnly(raw: string): boolean {
    return serializeChord(parseChord(raw) ?? { ctrl: false, shift: false, alt: false, key: "" }) === "ctrl+shift+p";
}
