"use client";

import { useState, useTransition } from "react";
import { saveMdlProfileUrl } from "@/actions/preferences";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function MdlProfileSetting({ initialUrl }: { initialUrl: string | null }) {
    const [value, setValue] = useState(initialUrl ?? "");
    const [saved, setSaved] = useState(initialUrl);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const dirty = value.trim() !== (saved ?? "");

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const res = await saveMdlProfileUrl(value);
            if (!res.ok) {
                setError(res.error ?? "Could not save.");
                return;
            }
            // Show the normalized form back, so a pasted username becomes the full URL
            setValue(res.url ?? "");
            setSaved(res.url);
            toast.success(res.url ? "MDL link saved" : "MDL link removed");
        });
    }

    return (
        <form onSubmit={submit} className="space-y-2.5">
            <div>
                <p className="text-sm font-medium text-fg">MyDramaList profile</p>
                <p className="text-xs text-fg-dim mt-0.5">
                    Adds an MDL shortcut to the header. Leave it empty to hide the link. Paste your profile
                    URL, or just your username.
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(null); }}
                    placeholder="https://mydramalist.com/dramalist/yourname"
                    spellCheck={false}
                    autoComplete="off"
                    className="flex-1 min-w-0 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:border-blue-500/50 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={isPending || !dirty}
                    className="shrink-0 cursor-pointer rounded-lg bg-blue-500 px-3.5 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isPending ? "Saving…" : "Save"}
                </button>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {saved && !error && (
                <a
                    href={saved}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-sky-400 transition-colors hover:text-sky-300"
                >
                    Open my profile
                    <ExternalLink className="h-3 w-3" />
                </a>
            )}
        </form>
    );
}
