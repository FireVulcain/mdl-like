"use client";

import { useState } from "react";
import { saveNotificationPreferences, type NotificationPreferences } from "@/actions/preferences";
import { SettingToggle } from "@/components/settings/setting-toggle";
import { toast } from "sonner";

export function NotificationSettings({ initialPrefs }: { initialPrefs: NotificationPreferences }) {
    const [showSync, setShowSync] = useState(initialPrefs.showSyncNotification);

    const save = async (prefs: Partial<NotificationPreferences>) => {
        await saveNotificationPreferences(prefs);
        toast.success("Notification preferences saved");
    };

    return (
        <div className="space-y-5">
            <SettingToggle
                checked={showSync}
                onChange={(next) => { setShowSync(next); save({ showSyncNotification: next }); }}
                label="Background sync banner"
                hint="Shows a small in-app banner when the nightly sync has updated your data."
            />
        </div>
    );
}
