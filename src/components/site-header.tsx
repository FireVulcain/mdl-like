"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { SearchInput } from "@/components/search-input";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SiteHeader() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    // Check if we're on the main media detail page (has backdrop)
    // Match /media/[id] but not /media/[id]/photos or /media/[id]/cast
    const isMediaDetailPage = /^\/media\/[^/]+$/.test(pathname);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navItems = [
        { name: "Home", href: "/" },
        { name: "Watchlist", href: "/watchlist" },
    ];

    return (
        <header className={cn("fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500 ease-in-out px-4", scrolled ? "py-2" : "py-4")}>
            <div
                className={cn(
                    "container mx-auto flex h-16 items-center justify-between gap-4 px-6 rounded-2xl transition-all duration-500",
                    scrolled
                        ? "bg-gray-900/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 h-14"
                        : isMediaDetailPage
                          ? "bg-gray-900/30 backdrop-blur-sm border border-white/5"
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
                        const isActive = pathname === item.href;
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
                </nav>

                {/* Search & Actions */}
                <div className="flex items-center gap-4 flex-1 md:flex-none justify-end">
                    <div className="hidden sm:block w-full max-w-xs group relative">
                        <div className="absolute -inset-1 bg-linear-to-r from-primary to-purple-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition duration-500" />
                        <Suspense fallback={<div className="h-10 w-full bg-muted/20 rounded-xl animate-pulse" />}>
                            <SearchInput />
                        </Suspense>
                    </div>

                    {/* User Mini Profile Placeholder (Optional Premium Touch) */}
                    <div className="hidden sm:flex h-10 w-10 rounded-xl bg-linear-to-br from-primary/20 to-purple-600/20 border border-white/10 p-0.5 cursor-pointer hover:border-primary/50 transition-all">
                        <div className="h-full w-full rounded-[10px] bg-background flex items-center justify-center text-xs font-bold text-primary">
                            ND
                        </div>
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
                                const isActive = pathname === item.href;
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
                        </nav>

                        {/* Mobile Profile */}
                        <div className="mt-4 pt-4 border-t border-white/10 sm:hidden">
                            <div className="flex items-center gap-3 px-4 py-2">
                                <div className="h-10 w-10 rounded-xl bg-linear-to-br from-primary/20 to-purple-600/20 border border-white/10 p-0.5">
                                    <div className="h-full w-full rounded-[10px] bg-background flex items-center justify-center text-xs font-bold text-primary">
                                        ND
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-white">Profile</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </header>
    );
}
