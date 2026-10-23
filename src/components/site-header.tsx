"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SearchInput } from "@/components/search-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { ExternalLink, Menu, X, Clock, Bookmark, LogOut, User2, BarChart3, Search } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { updateAvatar } from "@/actions/avatar";
import { getMenuStats, type MenuStats } from "@/actions/stats";
import { cn } from "@/lib/utils";

function formatMenuMinutes(minutes: number): string {
    return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} h`;
}

export function SiteHeader({ mdlProfileUrl, paletteShortcut }: { mdlProfileUrl?: string | null; paletteShortcut?: string | null }) {
    const { data: session } = useSession();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarCacheBust, setAvatarCacheBust] = useState(0);
    const [avatarError, setAvatarError] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();

    const avatarSrc = session?.user ? `/api/me/avatar?t=${avatarCacheBust}` : null;
    const displayName = session?.user?.name ?? "My Account";

    // Kept between openings: a reopened menu shows the last figures at once and
    // swaps in fresh ones when they land, instead of blanking every time.
    const [menuStats, setMenuStats] = useState<MenuStats | null>(null);
    const menuStatsLoading = useRef(false);
    function loadMenuStats() {
        if (menuStatsLoading.current) return;
        menuStatsLoading.current = true;
        getMenuStats()
            .then(setMenuStats)
            .catch((err) => console.error(err))
            .finally(() => { menuStatsLoading.current = false; });
    }

    const menuAvatar = (
        <span className="h-11 w-11 shrink-0 rounded-full bg-surface-4 flex items-center justify-center overflow-hidden">
            {avatarSrc && !avatarError ? (
                <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" onError={() => setAvatarError(true)} />
            ) : (
                <span className="text-sm font-semibold text-fg-soft">ND</span>
            )}
        </span>
    );

    async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        setAvatarUploading(true);
        try {
            const bitmap = await createImageBitmap(file);
            const canvas = document.createElement("canvas");
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext("2d")!;
            const size = Math.min(bitmap.width, bitmap.height);
            const sx = (bitmap.width - size) / 2;
            const sy = (bitmap.height - size) / 2;
            ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 200, 200);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            const res = await updateAvatar(dataUrl);
            if (!res.ok) { console.error(res.error); return; }
            setAvatarError(false);
            setAvatarCacheBust(Date.now());
        } finally {
            setAvatarUploading(false);
        }
    }

    // Check if we're on a page with a hero backdrop (home or media detail)
    const isHomePage = pathname === "/";
    const isMediaDetailPage = /^\/media\/[^/]+$/.test(pathname);
    const hasHeroBackdrop = isHomePage || isMediaDetailPage;

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        };
        if (profileOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [profileOpen]);

    // Close mobile search bar only when navigating away from search
    useEffect(() => {
        if (pathname !== "/search") {
            setMobileSearchOpen(false);
        }
    }, [pathname]);

    const navItems = [
        { name: "Home", href: "/" },
        { name: "Dramas", href: "/dramas?category=popular&country=KR&sort=vote_average.desc", activePath: "/dramas" },
        { name: "Watchlist", href: "/watchlist" },
        { name: "Calendar", href: "/calendar" },
    ];

    return (
        <header className={cn("fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500 ease-in-out px-4", scrolled ? "py-2" : "py-4")}>
            <div
                className={cn(
                    "relative container mx-auto flex h-16 items-center justify-between gap-4 px-6 rounded-2xl transition-all duration-500",
                    scrolled
                        ? "bg-[var(--header-scrolled)] backdrop-blur-xl border border-line-strong shadow-2xl shadow-black/20 h-14"
                        : hasHeroBackdrop
                          ? "bg-[var(--header-over-hero)] backdrop-blur-md border border-line-strong"
                          : "bg-[var(--header-idle)] backdrop-blur-md border border-line-soft shadow-2xl shadow-black/20",
                )}
            >
                {/* Mobile inline search bar — absolute so it doesn't affect flex layout */}
                <AnimatePresence>
                    {mobileSearchOpen && (
                        <motion.div
                            initial={{ clipPath: "inset(0 0 0 100%)" }}
                            animate={{ clipPath: "inset(0 0 0 0%)" }}
                            exit={{ clipPath: "inset(0 0 0 100%)" }}
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                            className="absolute inset-0 flex items-center gap-2 px-4 md:hidden rounded-2xl overflow-hidden"
                        >
                            <motion.div
                                className="flex-1 min-w-0"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12, delay: 0.08 }}
                            >
                                <Suspense fallback={<div className="h-10 w-full bg-muted/20 rounded-xl animate-pulse" />}>
                                    <SearchInput autoFocus />
                                </Suspense>
                            </motion.div>
                            <motion.button
                                onClick={() => setMobileSearchOpen(false)}
                                className="cursor-pointer shrink-0 p-2 rounded-xl bg-surface-2 border border-line-strong hover:bg-surface-4 transition-colors"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.1, delay: 0.1 }}
                            >
                                <X className="h-5 w-5 text-fg" />
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Branding */}
                <Link
                    href="/"
                    className={cn("group shrink-0 transition-opacity duration-100", mobileSearchOpen ? "opacity-0 pointer-events-none" : "opacity-100")}
                >
                    <span className="font-black text-2xl tracking-tight text-fg transition-all group-hover:opacity-80">
                        track<span className="text-primary">r</span>
                    </span>
                </Link>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-1 bg-surface-2 p-1 rounded-xl">
                    {navItems.map((item) => {
                        const isActive = pathname === (item.activePath ?? item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "relative px-4 py-1.5 text-sm font-semibold transition-colors rounded-lg",
                                    isActive ? "text-fg" : "text-muted-foreground hover:text-fg",
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-active"
                                        className="absolute inset-0 bg-primary/20 border border-primary/30 rounded-lg -z-10"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                {item.name}
                            </Link>
                        );
                    })}
                    {mdlProfileUrl && (
                        <a
                            href={mdlProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:text-fg transition-colors rounded-lg"
                        >
                            MDL
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </nav>

                {/* Search & Actions */}
                <div className={cn("flex items-center gap-4 flex-1 md:flex-none justify-end transition-opacity duration-100", mobileSearchOpen && "opacity-0 pointer-events-none")}>
                    <div className="hidden sm:block w-full max-w-xs group relative">
                        <div className="absolute -inset-1 bg-linear-to-r from-primary to-purple-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition duration-500" />
                        <Suspense fallback={<div className="h-10 w-full bg-muted/20 rounded-xl animate-pulse" />}>
                            <SearchInput paletteShortcut={paletteShortcut} />
                        </Suspense>
                    </div>

                    {/* Between search and the profile: a setting, so it belongs
                        with the other controls rather than buried in the menu —
                        and near enough to the edge that the circle it opens
                        sweeps across the whole page rather than out of the
                        middle of it. */}
                    <ThemeToggle />

                    {/* Profile dropdown */}
                    <div ref={profileRef} className="relative hidden sm:block">
                        {/* No frame at all: hover and the open menu are marked by a
                            shade laid over the picture itself. The button keeps the
                            theme toggle's 40px target around a smaller circle. */}
                        <button
                            type="button"
                            aria-label="Account menu"
                            aria-haspopup="menu"
                            aria-expanded={profileOpen}
                            onPointerEnter={loadMenuStats}
                            onClick={() => { if (!profileOpen) loadMenuStats(); setProfileOpen((o) => !o); }}
                            className="group flex size-10 items-center justify-center rounded-full cursor-pointer"
                        >
                            <span
                                className={cn(
                                    "relative flex size-8.5 items-center justify-center rounded-full bg-surface-4 overflow-hidden",
                                    "after:absolute after:inset-0 after:bg-black/20 after:transition-opacity",
                                    profileOpen ? "after:opacity-100" : "after:opacity-0 group-hover:after:opacity-100",
                                )}
                            >
                                {avatarSrc && !avatarError ? (
                                    <img src={avatarSrc} alt="" className="h-full w-full object-cover" onError={() => setAvatarError(true)} />
                                ) : (
                                    <span className="text-[11px] font-semibold text-fg-soft">ND</span>
                                )}
                            </span>
                        </button>

                        <AnimatePresence>
                            {profileOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.12, ease: "easeOut" }}
                                    className="absolute right-0 top-full mt-2 w-67 p-1.5 bg-box rounded-lg shadow-(--menu-shadow) z-50"
                                >
                                    {/* The profile is the head of the menu rather than a line in it */}
                                    {session?.user?.id ? (
                                        <Link
                                            href={`/u/${session.user.id}`}
                                            onClick={() => setProfileOpen(false)}
                                            className={cn(
                                                "flex items-center gap-3 p-2.5 rounded-md transition-colors",
                                                pathname === `/u/${session.user.id}` ? "bg-surface-4" : "hover:bg-surface-2",
                                            )}
                                        >
                                            {menuAvatar}
                                            <span className="grid min-w-0">
                                                <span className="text-[15px] font-semibold text-fg truncate">{displayName}</span>
                                                <span className="text-xs text-fg-dim">View profile</span>
                                            </span>
                                        </Link>
                                    ) : (
                                        <div className="flex items-center gap-3 p-2.5">
                                            {menuAvatar}
                                            <span className="text-[15px] font-semibold text-fg truncate">{displayName}</span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-px mt-1 mb-1.5 bg-line rounded-md overflow-hidden">
                                        {[
                                            { value: menuStats?.watchlist, label: "Watchlist" },
                                            { value: menuStats?.completed, label: "Completed" },
                                            { value: menuStats && formatMenuMinutes(menuStats.recentMinutes), label: "Past 30 days" },
                                        ].map((s) => (
                                            <div key={s.label} className="grid bg-box px-2.5 py-2">
                                                <span className="text-[15px] font-semibold text-fg tabular-nums">{s.value ?? "–"}</span>
                                                <span className="text-[11px] text-fg-dim truncate">{s.label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid gap-px">
                                        {[
                                            { href: "/watchlist", label: "Watchlist" },
                                            { href: "/history", label: "History" },
                                            { href: "/stats", label: "Stats" },
                                            { href: "/settings", label: "Settings" },
                                        ].map((item) => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setProfileOpen(false)}
                                                className={cn(
                                                    "px-2.5 py-1.75 rounded text-sm transition-colors",
                                                    pathname === item.href ? "bg-surface-4 text-fg" : "text-fg-soft hover:text-fg hover:bg-surface-2",
                                                )}
                                            >
                                                {item.label}
                                            </Link>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between mt-1.5 px-2.5 pt-2 pb-1 border-t border-line text-xs">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={avatarUploading}
                                            className="text-fg-dim hover:text-fg transition-colors cursor-pointer disabled:cursor-default disabled:hover:text-fg-dim"
                                        >
                                            {avatarUploading ? "Uploading…" : "Change photo"}
                                        </button>
                                        <button
                                            onClick={() => { setProfileOpen(false); signOut({ callbackUrl: "/login" }); }}
                                            className="text-fg-dim hover:text-fg transition-colors cursor-pointer"
                                        >
                                            Sign out
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Mobile Search Button */}
                    <button
                        onClick={() => setMobileSearchOpen(true)}
                        className="cursor-pointer md:hidden p-2 rounded-xl bg-surface-2 border border-line-strong hover:bg-surface-4 transition-colors"
                        aria-label="Search"
                    >
                        <Search className="h-5 w-5 text-fg" />
                    </button>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="cursor-pointer md:hidden p-2 rounded-xl bg-surface-2 border border-line-strong hover:bg-surface-4 transition-colors"
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X className="h-5 w-5 text-fg" /> : <Menu className="h-5 w-5 text-fg" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="container mx-auto mt-2 px-4"
                >
                    <div className="bg-panel/95 backdrop-blur-xl border border-line-strong rounded-2xl p-4 shadow-2xl shadow-black/40">
                        {/* Mobile Navigation */}
                        <nav className="flex flex-col gap-1">
                            {navItems.map((item) => {
                                const isActive = pathname === (item.activePath ?? item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={cn(
                                            "px-4 py-3 text-sm font-semibold transition-colors rounded-xl",
                                            isActive
                                                ? "bg-primary/20 border border-primary/30 text-fg"
                                                : "text-muted-foreground hover:text-fg hover:bg-surface-2",
                                        )}
                                    >
                                        {item.name}
                                    </Link>
                                );
                            })}
                            {mdlProfileUrl && (
                                <a
                                    href={mdlProfileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-fg hover:bg-surface-2 transition-colors rounded-xl"
                                >
                                    MDL
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </nav>

                        {/* Mobile Profile */}
                        <div className="mt-4 pt-4 border-t border-line-strong sm:hidden">
                            <div className="flex items-center gap-3 px-4 py-2 mb-1">
                                <div className="h-8 w-8 shrink-0 rounded-lg bg-linear-to-br from-primary/20 to-purple-600/20 border border-line-strong p-0.5 overflow-hidden">
                                    <div className="h-full w-full rounded-md bg-background flex items-center justify-center overflow-hidden">
                                        {avatarSrc && !avatarError ? (
                                            <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" onError={() => setAvatarError(true)} />
                                        ) : (
                                            <span className="text-[10px] font-bold text-primary">ND</span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-sm font-semibold text-fg">My Account</span>
                            </div>
                            {session?.user?.id && (
                                <Link
                                    href={`/u/${session.user.id}`}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                        "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-xl",
                                        pathname === `/u/${session.user.id}`
                                            ? "bg-primary/15 border border-primary/20 text-fg"
                                            : "text-fg-muted hover:text-fg hover:bg-surface-2",
                                    )}
                                >
                                    <User2 className="h-4 w-4 shrink-0" />
                                    My Profile
                                </Link>
                            )}
                            <Link
                                href="/watchlist"
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-xl",
                                    pathname === "/watchlist"
                                        ? "bg-primary/15 border border-primary/20 text-fg"
                                        : "text-fg-muted hover:text-fg hover:bg-surface-2",
                                )}
                            >
                                <Bookmark className="h-4 w-4 shrink-0" />
                                Watchlist
                            </Link>
                            <Link
                                href="/history"
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-xl",
                                    pathname === "/history"
                                        ? "bg-primary/15 border border-primary/20 text-fg"
                                        : "text-fg-muted hover:text-fg hover:bg-surface-2",
                                )}
                            >
                                <Clock className="h-4 w-4 shrink-0" />
                                History
                            </Link>
                            <Link
                                href="/stats"
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-xl",
                                    pathname === "/stats"
                                        ? "bg-primary/15 border border-primary/20 text-fg"
                                        : "text-fg-muted hover:text-fg hover:bg-surface-2",
                                )}
                            >
                                <BarChart3 className="h-4 w-4 shrink-0" />
                                Stats
                            </Link>
                            <div className="my-1 border-t border-line-strong" />
                            <button
                                onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-fg-muted hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-xl cursor-pointer"
                            >
                                <LogOut className="h-4 w-4 shrink-0" />
                                Sign out
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}


            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
            />
        </header>
    );
}
