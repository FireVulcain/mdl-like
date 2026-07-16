"use client";

import { useState } from "react";
import Link from "next/link";
import { saveProfilePreferences, type ProfilePreferences } from "@/actions/preferences";
import { SettingToggle } from "@/components/settings/setting-toggle";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function ProfileSettings({ initialPrefs, profileUserId }: { initialPrefs: ProfilePreferences; profileUserId: string }) {
    const [enabled, setEnabled] = useState(initialPrefs.publicProfileEnabled);
    const [showScores, setShowScores] = useState(initialPrefs.publicShowScores);

    const save = async (prefs: Partial<ProfilePreferences>) => {
        await saveProfilePreferences(prefs);
        toast.success("Profile preferences saved");
    };

    return (
        <div className="space-y-5">
            <SettingToggle
                checked={enabled}
                onChange={(next) => { setEnabled(next); save({ publicProfileEnabled: next }); }}
                label="Public profile enabled"
                hint="When off, your profile page returns a 404 for visitors. You can always preview it yourself."
            />
            <SettingToggle
                checked={showScores}
                onChange={(next) => { setShowScores(next); save({ publicShowScores: next }); }}
                label="Show my scores to visitors"
                hint="When off, visitors see your watchlist without ratings (and no average score)."
            />
            <Link
                href={`/u/${profileUserId}`}
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
                <ExternalLink className="h-3.5 w-3.5" />
                Preview my public profile
            </Link>
        </div>
    );
}
