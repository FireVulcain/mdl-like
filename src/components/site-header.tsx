"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SearchInput } from "@/components/search-input";
import { ExternalLink, Menu, X, Clock, Bookmark, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

export function SiteHeader() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

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

    const navItems = [
        { name: "Home", href: "/" },
        { name: "Dramas", href: "/dramas?category=popular&country=KR&sort=vote_average.desc", activePath: "/dramas" },
        { name: "Watchlist", href: "/watchlist" },
        { name: "Schedule", href: "/schedule" },
    ];

    return (
        <header className={cn("fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500 ease-in-out px-4", scrolled ? "py-2" : "py-4")}>
            <div
                className={cn(
                    "container mx-auto flex h-16 items-center justify-between gap-4 px-6 rounded-2xl transition-all duration-500",
                    scrolled
                        ? "bg-gray-900/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 h-14"
                        : hasHeroBackdrop
                          ? "bg-black/40 backdrop-blur-md border border-white/10"
                          : "bg-gray-900/50 backdrop-blur-md border border-white/5 shadow-2xl shadow-black/20",
                )}
            >
                {/* Branding */}
                <Link href="/" className="group">
                    <span className="font-black text-2xl tracking-tight text-white transition-all group-hover:opacity-80">
                        track<span className="text-primary">r</span>
                    </span>
                </Link>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl">
                    {navItems.map((item) => {
                        const isActive = pathname === (item.activePath ?? item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "relative px-4 py-1.5 text-sm font-semibold transition-colors rounded-lg",
                                    isActive ? "text-white" : "text-muted-foreground hover:text-white",
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
                    <a
                        href="https://mydramalist.com/dramalist/Popoooo_"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-muted-foreground hover:text-white transition-colors rounded-lg"
                    >
                        MDL
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </nav>

                {/* Search & Actions */}
                <div className="flex items-center gap-4 flex-1 md:flex-none justify-end">
                    <div className="hidden sm:block w-full max-w-xs group relative">
                        <div className="absolute -inset-1 bg-linear-to-r from-primary to-purple-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition duration-500" />
                        <Suspense fallback={<div className="h-10 w-full bg-muted/20 rounded-xl animate-pulse" />}>
                            <SearchInput />
                        </Suspense>
                    </div>

                    {/* Profile dropdown */}
                    <div ref={profileRef} className="relative hidden sm:block">
                        <div
                            onClick={() => setProfileOpen((o) => !o)}
                            className={cn(
                                "flex h-10 w-10 rounded-xl bg-linear-to-br from-primary/20 to-purple-600/20 border p-0.5 cursor-pointer transition-all",
                                profileOpen ? "border-primary/60 shadow-lg shadow-primary/10" : "border-white/10 hover:border-primary/50",
                            )}
                        >
                            <div className="h-full w-full rounded-[10px] bg-background flex items-center justify-center text-xs font-bold text-primary">
                                ND
                            </div>
                        </div>

                        <AnimatePresence>
                            {profileOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                                    transition={{ duration: 0.15, ease: "easeOut" }}
                                    className="absolute right-0 top-full mt-2 w-48 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden z-50"
                                >
                                    {/* Account header */}
                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6">
                                        <div className="h-8 w-8 shrink-0 rounded-lg bg-linear-to-br from-primary/20 to-purple-600/20 border border-white/10 p-0.5">
                                            <div className="h-full w-full rounded-md bg-background flex items-center justify-center text-[10px] font-bold text-primary">
                                                ND
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">My Account</p>
                                            <p className="text-xs text-white/40 truncate">Personal</p>
                                        </div>
                                    </div>

                                    {/* Menu items */}
                                    <div className="p-1.5">
                                        <Link
                                            href="/watchlist"
                                            onClick={() => setProfileOpen(false)}
                                            className={cn(
                                                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                                pathname === "/watchlist"
                                                    ? "bg-primary/15 text-white"
                                                    : "text-white/60 hover:text-white hover:bg-white/5",
                                            )}
                                        >
                                            <Bookmark className="h-4 w-4 shrink-0" />
                                            Watchlist
                                        </Link>
                                        <Link
                                            href="/history"
                                            onClick={() => setProfileOpen(false)}
                                            className={cn(
                                                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                                pathname === "/history"
                                                    ? "bg-primary/15 text-white"
                                                    : "text-white/60 hover:text-white hover:bg-white/5",
                                            )}
                                        >
                                            <Clock className="h-4 w-4 shrink-0" />
                                            History
                                        </Link>
                                        <div className="my-1 border-t border-white/6" />
                                        <button
                                            onClick={() => { setProfileOpen(false); signOut({ callbackUrl: "/login" }); }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                        >
                                            <LogOut className="h-4 w-4 shrink-0" />
                                            Sign out
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="cursor-pointer md:hidden p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
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
                    <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/40">
                        {/* Mobile Search */}
                        <div className="mb-4 sm:hidden">
                            <Suspense fallback={<div className="h-10 w-full bg-muted/20 rounded-xl animate-pulse" />}>
                                <SearchInput />
                            </Suspense>
                        </div>

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
                                                ? "bg-primary/20 border border-primary/30 text-white"
                                                : "text-muted-foreground hover:text-white hover:bg-white/5",
                                        )}
                                    >
                                        {item.name}
                                    </Link>
                                );
                            })}
                            <a
                                href="https://mydramalist.com/dramalist/Popoooo_"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-white hover:bg-white/5 transition-colors rounded-xl"
                            >
                                MDL
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </nav>

                        {/* Mobile Profile */}
                        <div className="mt-4 pt-4 border-t border-white/10 sm:hidden">
                            <div className="flex items-center gap-3 px-4 py-2 mb-1">
                                <div className="h-8 w-8 shrink-0 rounded-lg bg-linear-to-br from-primary/20 to-purple-600/20 border border-white/10 p-0.5">
                                    <div className="h-full w-full rounded-md bg-background flex items-center justify-center text-[10px] font-bold text-primary">
                                        ND
                                    </div>
                                </div>
                                <span className="text-sm font-semibold text-white">My Account</span>
                            </div>
                            <Link
                                href="/watchlist"
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-xl",
                                    pathname === "/watchlist"
                                        ? "bg-primary/15 border border-primary/20 text-white"
                                        : "text-white/60 hover:text-white hover:bg-white/5",
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
                                        ? "bg-primary/15 border border-primary/20 text-white"
                                        : "text-white/60 hover:text-white hover:bg-white/5",
                                )}
                            >
                                <Clock className="h-4 w-4 shrink-0" />
                                History
                            </Link>
                            <div className="my-1 border-t border-white/10" />
                            <button
                                onClick={() => { setMobileMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-xl cursor-pointer"
                            >
                                <LogOut className="h-4 w-4 shrink-0" />
                                Sign out
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </header>
    );
}
