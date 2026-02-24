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
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none rounded-xl border border-white/8 bg-white/3 px-1.5 py-1.5">
            {sections.map(({ id, label }) => (
                <button
                    key={id}
                    onClick={() => handleClick(id)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/8 transition-colors whitespace-nowrap cursor-pointer"
                >
                    {label}
                </button>
            ))}
        </nav>
    );
}
