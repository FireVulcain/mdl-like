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
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
                )}
            </div>

            {overflows && (
                <div className="flex justify-center mt-4">
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium text-sky-400 border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 hover:border-sky-500/50 transition-all"
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
