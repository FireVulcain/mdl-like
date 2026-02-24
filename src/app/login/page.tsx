"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    }),
};

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Invalid email or password");
                setIsLoading(false);
            } else {
                router.push("/");
                router.refresh();
            }
        } catch {
            setError("Something went wrong. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center -mt-24">
            {/* Background — identical to rest of the site */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#0a0a0f]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />
                <div className="absolute -top-40 -left-40 w-125 h-125 bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-125 h-125 bg-blue-500/12 rounded-full blur-[180px]" />
                <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay">
                    <svg width="100%" height="100%">
                        <filter id="noise">
                            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" />
                        </filter>
                        <rect width="100%" height="100%" filter="url(#noise)" />
                    </svg>
                </div>
            </div>

            <div className="relative z-10 w-full max-w-sm mx-4">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
                >
                    {/* Top accent line */}
                    <div className="h-px bg-linear-to-r from-transparent via-blue-500/50 to-transparent" />

                    <div className="px-8 pt-8 pb-8">
                        {/* Brand */}
                        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show" className="mb-8">
                            <span className="font-black text-3xl tracking-tight text-white">
                                track<span className="text-primary">r</span>
                            </span>
                            <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
                        </motion.div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="flex items-center gap-2.5 bg-red-500/8 border border-red-500/20 text-red-400 px-3.5 py-2.5 rounded-xl text-sm"
                                >
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </motion.div>
                            )}

                            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show" className="space-y-1.5">
                                <label htmlFor="email" className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-10 bg-white/5 border-white/8 text-white placeholder:text-gray-600 focus-visible:border-blue-500/50 focus-visible:ring-0 focus-visible:bg-white/8 transition-colors rounded-xl"
                                    required
                                />
                            </motion.div>

                            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show" className="space-y-1.5">
                                <label htmlFor="password" className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Password
                                </label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-10 bg-white/5 border-white/8 text-white placeholder:text-gray-600 focus-visible:border-blue-500/50 focus-visible:ring-0 focus-visible:bg-white/8 transition-colors rounded-xl"
                                    required
                                />
                            </motion.div>

                            <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-10 rounded-xl bg-linear-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Signing in…
                                        </>
                                    ) : (
                                        "Sign in"
                                    )}
                                </button>
                            </motion.div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
