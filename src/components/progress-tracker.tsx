"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ProgressTrackerProps {
    current: number;
    total?: number | null;
    status: string;
    onUpdate?: (progress: number) => void;
    className?: string;
    compact?: boolean;
}

export function ProgressTracker({ current, total, status, onUpdate, className, compact = false }: ProgressTrackerProps) {
    // Local state for immediate feedback
    const [progress, setProgress] = useState(current);

    // Sync with server value when the prop changes (e.g. season switch)
    useEffect(() => {
        setProgress(current);
    }, [current]);

    const handleUpdate = (newVal: number) => {
        const val = Math.max(0, newVal);
        // If total is known, don't exceed it
        const limit = total || 9999;
        const finalVal = Math.min(val, limit);

        setProgress(finalVal);
        onUpdate?.(finalVal);
    };

    const percentage = total ? (progress / total) * 100 : 0;
    const isCompleted = total && progress >= total;

    // Compact inline version
    if (compact) {
        return (
            <div className={cn("flex items-center gap-2", className)}>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full bg-surface-4 text-fg-muted hover:text-fg hover:bg-surface-4 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() => handleUpdate(progress - 1)}
                    disabled={progress <= 0}
                >
                    <Minus className="h-3 w-3" />
                </Button>
                <span className="text-fg font-medium text-sm min-w-[60px] text-center">
                    {progress} {total ? `/ ${total}` : "eps"}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full bg-surface-4 text-fg-muted hover:text-fg hover:bg-surface-4 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() => handleUpdate(progress + 1)}
                    disabled={total ? progress >= total : false}
                >
                    <Plus className="h-3 w-3" />
                </Button>
            </div>
        );
    }

    // Full version
    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center justify-between">
                <span className="text-sm text-fg-muted">Episodes Watched</span>
                <span className="text-fg font-semibold">
                    {progress} {total ? `/ ${total}` : "eps"}
                </span>
            </div>

            {total && (
                <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                        className={`h-full transition-all duration-500 ${
                            isCompleted
                                ? "bg-gradient-to-r from-green-500 to-emerald-500"
                                : "bg-gradient-to-r from-blue-500 to-blue-400"
                        }`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            )}

            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-surface-3 border border-line-strong text-fg-muted hover:text-fg hover:bg-surface-4 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() => handleUpdate(progress - 1)}
                    disabled={progress <= 0}
                >
                    <Minus className="h-4 w-4" />
                </Button>
                <Input
                    type="number"
                    className="flex-1 h-9 bg-surface-3 border-line-strong rounded-lg text-fg text-center focus-visible:bg-surface-4 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={progress}
                    onChange={(e) => handleUpdate(parseInt(e.target.value) || 0)}
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-surface-3 border border-line-strong text-fg-muted hover:text-fg hover:bg-surface-4 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={() => handleUpdate(progress + 1)}
                    disabled={total ? progress >= total : false}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
