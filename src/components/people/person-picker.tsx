"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2, User } from "lucide-react";
import type { PersonSearchHit } from "@/app/api/people/search/route";

export type PickedPerson = { slug: string; name: string; image: string | null };

/**
 * Whether a pick is on its way to the server. Module scope, because the two
 * pickers and the hint under them are siblings with no parent of their own
 * to hold it — and a provider around the page for one boolean is more code
 * than this.
 */
let pairPending = false;
const pendingListeners = new Set<() => void>();
function setPairPending(next: boolean) {
    if (pairPending === next) return;
    pairPending = next;
    pendingListeners.forEach((fn) => fn());
}
function usePairPending() {
    return useSyncExternalStore(
        (fn) => {
            pendingListeners.add(fn);
            return () => pendingListeners.delete(fn);
        },
        () => pairPending,
        () => false,
    );
}

/**
 * Where the answer is about to appear, a line saying so. The picked face shows
 * in its slot at once; this is what fills the second or two before the shared
 * titles arrive, in the place they will arrive.
 */
export function PairPendingHint({ a, b }: { a: string | null; b: string | null }) {
    const pending = usePairPending();
    if (!pending) return null;
    return (
        <p className="flex items-center gap-2 text-sm text-fg-dim">
            <Loader2 className="h-4 w-4 animate-spin" />
            {a && b ? `Finding what ${a} and ${b} share…` : "Loading…"}
        </p>
    );
}

function Avatar({ src, name, size = "h-9 w-9", className = "" }: { src: string | null; name: string; size?: string; className?: string }) {
    const large = size.includes("28");
    return (
        <span className={`relative block ${size} shrink-0 overflow-hidden rounded-full bg-surface-3 ${className}`}>
            {src ? (
                <Image unoptimized src={src} alt={name} fill sizes={large ? "112px" : "40px"} className="object-cover" />
            ) : (
                <span className="absolute inset-0 flex items-center justify-center text-fg-faint">
                    <User className={large ? "h-10 w-10" : "h-4 w-4"} />
                </span>
            )}
        </span>
    );
}

/**
 * One of the two slots on /people/together. The choice lives in the URL — the
 * server renders whatever ?a and ?b name, and this only edits its own key —
 * so a pairing is a link, and the back button undoes a pick.
 *
 * Same shape as the tag picker on /dramas: a debounced fetch against a small
 * route, a dropdown, and nothing kept in client state that the page does not
 * already know.
 */
export function PersonPicker({ slot, selected, autoFocus = false }: { slot: "a" | "b"; selected: PickedPerson | null; autoFocus?: boolean }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<PersonSearchHit[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    // The pick, shown in the slot before the server has confirmed it
    const [optimistic, setOptimistic] = useState<PickedPerson | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/people/search?q=${encodeURIComponent(query.trim())}`);
                const data: PersonSearchHit[] = await res.json();
                setResults(data);
                setOpen(true);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    // The server props catch up once the navigation lands; until then the slot
    // shows the pick as if it had already landed, and the hint below the slots
    // says the rest is on its way.
    useEffect(() => {
        setOptimistic(null);
        setPairPending(false);
    }, [selected]);

    function navigate(slug: string | null) {
        const params = new URLSearchParams(searchParams.toString());
        if (slug) params.set(slot, slug);
        else params.delete(slot);
        const qs = params.toString();
        router.push(qs ? `/people/together?${qs}` : "/people/together");
    }

    function pick(hit: PersonSearchHit) {
        setQuery("");
        setOpen(false);
        setOptimistic({ slug: hit.slug, name: hit.name, image: hit.image });
        setPairPending(true);
        navigate(hit.slug);
    }

    const shown = selected ?? optimistic;

    // The portrait is the slot, with a name under it — or, while empty, the
    // slot's own label in the name's place, so the two sides stay level and
    // the ampersand between them stays put whichever is filled.
    if (shown) {
        return (
            <div className="flex flex-col items-center gap-3 py-2">
                <span className="relative block">
                    <Avatar src={shown.image} name={shown.name} size="h-28 w-28" className="ring-2 ring-line-strong shadow-xl shadow-black/30" />
                    <button
                        type="button"
                        onClick={() => navigate(null)}
                        aria-label={`Remove ${shown.name}`}
                        title="Change"
                        className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-fg-dim shadow-md transition-colors hover:bg-surface-3 hover:text-fg cursor-pointer"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </span>
                <span className="max-w-full truncate font-display text-lg font-semibold text-fg">{shown.name}</span>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col items-center gap-3 py-2" ref={containerRef}>
            {/* Dashed, and lighter than a portrait: a place waiting to be filled */}
            <Avatar src={null} name="" size="h-28 w-28" className="border-2 border-dashed border-line-strong !bg-surface-1" />
            <span className="font-display text-lg font-semibold text-fg-faint">{slot === "a" ? "First person" : "Second person"}</span>
            <div className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-line-strong bg-surface-1 px-3 py-2 focus-within:border-sky-500/50">
                {loading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-fg-dim" />
                ) : (
                    <Search className="h-4 w-4 shrink-0 text-fg-dim" />
                )}
                <input
                    type="text"
                    value={query}
                    autoFocus={autoFocus}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder="Search a name…"
                    className="w-full bg-transparent text-sm text-fg placeholder:text-fg-faint outline-none"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            setOpen(false);
                        }}
                        className="shrink-0 text-fg-faint transition-colors hover:text-fg-muted cursor-pointer"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {open && results.length > 0 && (
                <div className="absolute left-1/2 top-full z-30 mt-1 w-full max-w-xs -translate-x-1/2 overflow-hidden rounded-lg border border-line-strong bg-panel/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    {results.map((hit) => (
                        <button
                            key={hit.slug}
                            type="button"
                            onClick={() => pick(hit)}
                            className="flex w-full items-center gap-3 border-b border-line-soft px-3 py-2 text-left transition-colors last:border-0 hover:bg-surface-3 cursor-pointer"
                        >
                            <Avatar src={hit.image} name={hit.name} size="h-8 w-8" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-fg">{hit.name}</span>
                                {(hit.nationality || hit.knownFor) && (
                                    <span className="block truncate text-xs text-fg-dim">
                                        {hit.nationality}
                                        {hit.nationality && hit.knownFor && " · "}
                                        {hit.knownFor && <span className="text-fg-muted">{hit.knownFor}</span>}
                                    </span>
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {open && !loading && results.length === 0 && query.trim().length >= 2 && (
                <div className="absolute left-1/2 top-full z-30 mt-1 w-full max-w-xs -translate-x-1/2 rounded-lg border border-line-strong bg-panel/95 px-3 py-2 text-xs text-fg-dim shadow-2xl shadow-black/40 backdrop-blur-xl">
                    No one found
                </div>
            )}
        </div>
    );
}
