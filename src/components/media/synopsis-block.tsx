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
            <h3 className="text-lg font-semibold mb-2">Synopsis</h3>
            <p
                className={`leading-relaxed text-muted-foreground whitespace-pre-line ${
                    !expanded && isLong ? "line-clamp-5" : ""
                }`}
            >
                {text}
            </p>
            {isLong && (
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/8 hover:text-white/90 hover:border-white/20 transition-all cursor-pointer"
                >
                    {expanded ? "Show less" : "Read more"}
                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
            )}
        </div>
    );
}
