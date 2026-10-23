"use client";

import { useState, useTransition } from "react";
import { saveMdlProfileUrl } from "@/actions/preferences";
import { settingsButton, settingsInput, settingsLink } from "@/components/settings/settings-ui";
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
        <form onSubmit={submit} className="grid max-w-xl gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => { setValue(e.target.value); setError(null); }}
                    placeholder="Profile URL or username"
                    aria-label="MyDramaList profile"
                    spellCheck={false}
                    autoComplete="off"
                    className={`${settingsInput} min-w-0 flex-1`}
                />
                <button type="submit" disabled={isPending || !dirty} className={settingsButton}>
                    {isPending ? "Saving…" : "Save"}
                </button>
                {saved && !dirty && (
                    <a href={saved} target="_blank" rel="noopener noreferrer" className={settingsLink}>
                        Open
                    </a>
                )}
            </div>
            {error && <p className="text-xs text-dropped">{error}</p>}
        </form>
    );
}
