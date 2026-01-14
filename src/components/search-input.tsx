"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";

export function SearchInput() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("q", term);
        } else {
            params.delete("q");
        }

        startTransition(() => {
            router.replace(`/search?${params.toString()}`);
        });
    }, 300);

    return (
        <div className="relative w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
                type="search"
                placeholder="Search dramas, movies..."
                className="pl-10 h-10 bg-white/5 border-white/5 rounded-xl focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                onChange={(e) => handleSearch(e.target.value)}
                defaultValue={searchParams.get("q")?.toString()}
            />
        </div>
    );
}
