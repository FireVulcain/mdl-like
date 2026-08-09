"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const COLLAPSE_THRESHOLD = 300; // characters, or more than 4 newlines

interface Props {
    text: string;
}

export function SynopsisBlock({ text }: Props) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > COLLAPSE_THRESHOLD || text.split("\n").length > 4;

    return (
        <div className="prose prose-invert max-w-none">
            <h3 className="font-display text-lg font-semibold mb-2">Synopsis</h3>
            <p
                className={`leading-relaxed text-muted-foreground whitespace-pre-line ${
                    !expanded && isLong ? "line-clamp-5" : ""
                }`}
            >
                {text}
            </p>
            {isLong && (
                // Text, not a filled capsule. Every other expander on this page —
                // the episode synopses, the reviews, the comments — is already a
                // plain coloured toggle; this one was the odd button out.
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                >
                    {expanded ? "Show less" : "Read more"}
                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
            )}
        </div>
    );
}
