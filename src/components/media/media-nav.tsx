"use client";

export interface NavSection {
    id: string;
    label: string;
}

export function MediaNav({ sections }: { sections: NavSection[] }) {
    if (sections.length < 2) return null;

    function handleClick(id: string) {
        const el = document.getElementById(id);
        if (!el) return;
        // Offset by 96px (fixed header height)
        const top = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top, behavior: "smooth" });
    }

    return (
        // A tab strip, not a floating pill bar. The rule underneath groups the
        // items and separates them from the content below, which is what the
        // enclosing box was doing — except a box also detached the strip from the
        // section it introduces.
        <nav className="flex items-center gap-5 overflow-x-auto scrollbar-none border-b border-line pb-2.5">
            {sections.map(({ id, label }) => (
                <button
                    key={id}
                    onClick={() => handleClick(id)}
                    className="shrink-0 text-sm font-medium text-fg-muted hover:text-fg transition-colors whitespace-nowrap cursor-pointer"
                >
                    {label}
                </button>
            ))}
        </nav>
    );
}
