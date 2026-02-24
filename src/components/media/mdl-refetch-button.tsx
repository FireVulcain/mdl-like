"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface MdlRefetchButtonProps {
    tmdbExternalId: string;
    mediaId: string;
}

export function MdlRefetchButton({ tmdbExternalId, mediaId }: MdlRefetchButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleRefetch() {
        setLoading(true);
        try {
            const res = await fetch("/api/mdl/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tmdbExternalId, mediaId }),
            });
            if (!res.ok) throw new Error("Reset failed");
            toast.success("MDL cache cleared — refreshing data…");
            router.refresh();
        } catch {
            toast.error("Failed to reset MDL cache");
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={handleRefetch}
            disabled={loading}
            title="Refresh MDL cache"
            className="text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
            <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
        </button>
    );
}
