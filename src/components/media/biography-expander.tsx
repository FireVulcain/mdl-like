"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function BiographyExpander({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const [overflows, setOverflows] = useState(false);
    const pRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        if (pRef.current) {
            // 4.5rem at 16px base = 72px; check if content is taller
            setOverflows(pRef.current.scrollHeight > 72);
        }
    }, [text]);

    return (
        <div>
            <div className={`relative overflow-hidden ${expanded || !overflows ? "" : "max-h-18"}`}>
                <p ref={pRef} className="leading-relaxed text-muted-foreground whitespace-pre-line">{text}</p>
                {!expanded && overflows && (
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-panel to-transparent pointer-events-none" />
                )}
            </div>

            {/* Text, left-aligned under the paragraph it expands — the same toggle
                as the synopsis on /media. It was a centred, filled, fully-rounded
                capsule, which read as the page's main action when it is a way to
                see three more lines of biography. */}
            {overflows && (
                <div className="mt-2">
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="cursor-pointer inline-flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300 transition-colors"
                    >
                        {expanded ? (
                            <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
                        ) : (
                            <>Read more <ChevronDown className="h-3.5 w-3.5" /></>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
