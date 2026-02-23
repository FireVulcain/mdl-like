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
            title="Refetch MDL data"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-sm text-gray-300 hover:text-white hover:bg-white/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>MDL</span>
        </button>
    );
}
