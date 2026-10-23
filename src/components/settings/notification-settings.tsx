"use client";

import { useState } from "react";
import { saveNotificationPreferences, type NotificationPreferences } from "@/actions/preferences";
import { SettingRow, Switch } from "@/components/settings/settings-ui";
import { toast } from "sonner";

export function NotificationSettings({ initialPrefs }: { initialPrefs: NotificationPreferences }) {
    const [showSync, setShowSync] = useState(initialPrefs.showSyncNotification);

    const save = async (prefs: Partial<NotificationPreferences>) => {
        await saveNotificationPreferences(prefs);
        toast.success("Notification preferences saved");
    };

    return (
        <SettingRow label="Background sync banner" hint="Shows a small in-app banner when the nightly sync has updated your data.">
            <Switch
                label="Background sync banner"
                checked={showSync}
                onChange={(next) => {
                    setShowSync(next);
                    save({ showSyncNotification: next });
                }}
            />
        </SettingRow>
    );
}
