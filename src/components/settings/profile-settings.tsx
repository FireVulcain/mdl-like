"use client";

import { useState } from "react";
import { saveProfilePreferences, type ProfilePreferences } from "@/actions/preferences";
import { SettingRow, Switch } from "@/components/settings/settings-ui";
import { toast } from "sonner";

const ROWS: { key: keyof ProfilePreferences; label: string; hint: string }[] = [
    {
        key: "publicProfileEnabled",
        label: "Public profile enabled",
        hint: "When off, your profile page returns a 404 for visitors. You can always preview it yourself.",
    },
    {
        key: "publicShowScores",
        label: "Show my scores to visitors",
        hint: "When off, visitors see your watchlist without ratings (and no average score).",
    },
    {
        key: "publicShowPodium",
        label: "Show my Top 3 to visitors",
        hint: "When off, the podium section is hidden from visitors. You still see it.",
    },
    {
        key: "publicShowActivity",
        label: "Show my recent activity to visitors",
        hint: "When off, the activity feed is hidden from visitors. You still see it.",
    },
];

export function ProfileSettings({ initialPrefs }: { initialPrefs: ProfilePreferences }) {
    const [prefs, setPrefs] = useState(initialPrefs);

    const set = async (key: keyof ProfilePreferences, next: boolean) => {
        setPrefs((p) => ({ ...p, [key]: next }));
        await saveProfilePreferences({ [key]: next });
        toast.success("Profile preferences saved");
    };

    return (
        <>
            {ROWS.map((row) => (
                <SettingRow key={row.key} label={row.label} hint={row.hint}>
                    <Switch label={row.label} checked={prefs[row.key]} onChange={(next) => set(row.key, next)} />
                </SettingRow>
            ))}
        </>
    );
}
