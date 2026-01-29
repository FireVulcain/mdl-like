"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clapperboard, Lock, Mail, Loader2 } from "lucide-react";

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
        <div className="relative min-h-screen overflow-hidden flex items-center justify-center -mt-24">
            {/* Background */}
            <div className="fixed inset-0 -z-10">
                {/* Deep dark base */}
                <div className="absolute inset-0 bg-[#0a0a0f]" />

                {/* Subtle radial gradient for depth */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />

                {/* Accent glows at edges */}
                <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-blue-500/12 rounded-full blur-[180px]" />

                {/* Noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay">
                    <svg width="100%" height="100%">
                        <filter id="noise">
                            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" />
                        </filter>
                        <rect width="100%" height="100%" filter="url(#noise)" />
                    </svg>
                </div>
            </div>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md mx-4">
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/20">
                    {/* Logo / Title */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
                            <Clapperboard className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">MediaTracker</h1>
                        <p className="text-muted-foreground mt-2">Sign in to continue</p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 bg-white/5 border-white/10 focus:border-blue-500/50"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 bg-white/5 border-white/10 focus:border-blue-500/50"
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 h-11 mt-6"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
