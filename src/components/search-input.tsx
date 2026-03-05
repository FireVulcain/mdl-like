"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, useEffect, useTransition } from "react";
import { useDebouncedCallback } from "use-debounce";

export function SearchInput({ autoFocus }: { autoFocus?: boolean }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);

    // Store the page the user was on before searching
    const previousPathRef = useRef<string | null>(null);

    // Track the path when not on search page
    useEffect(() => {
        if (pathname !== "/search") {
            previousPathRef.current = pathname;
        }
    }, [pathname]);

    useEffect(() => {
        if (autoFocus) {
            // Small delay to let the overlay animation settle before focusing
            const t = setTimeout(() => inputRef.current?.focus(), 100);
            return () => clearTimeout(t);
        }
    }, [autoFocus]);

    const handleSearch = useDebouncedCallback((term: string) => {
        if (term) {
            const params = new URLSearchParams(searchParams);
            params.set("q", term);
            startTransition(() => {
                router.replace(`/search?${params.toString()}`);
            });
        } else {
            // Navigate back to previous page or home
            startTransition(() => {
                router.replace(previousPathRef.current || "/");
            });
        }
    }, 300);

    return (
        <div className="relative w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
                ref={inputRef}
                type="search"
                placeholder="Search dramas, movies..."
                className="pl-10 h-10 bg-white/5 border-white/5 rounded-xl focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                onChange={(e) => handleSearch(e.target.value)}
                defaultValue={searchParams.get("q")?.toString()}
            />
        </div>
    );
}
