import { Suspense } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/search-input";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4 m-auto">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <span className="hidden font-bold sm:inline-block">
            MediaTracker
          </span>
        </Link>
        <nav className="flex items-center gap-2">
            <Link href="/watchlist" className="text-sm font-medium hover:text-primary transition-colors">
              Watchlist
            </Link>
        </nav>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:flex-none">
            <Suspense fallback={<div className="w-full max-w-sm h-10 bg-muted/20 rounded-md" />}>
              <SearchInput />
            </Suspense>
          </div>
        </div>
      </div>
    </header>
  );
}
