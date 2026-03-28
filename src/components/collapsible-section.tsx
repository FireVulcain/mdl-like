"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function CollapsibleSection({
    title,
    icon,
    children,
    defaultOpen = true,
}: {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div>
            <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 mb-3 group cursor-pointer"
            >
                {icon}
                <h2 className="text-lg font-semibold text-white">{title}</h2>
                <ChevronDown
                    className={`h-4 w-4 text-gray-500 group-hover:text-gray-300 transition-all duration-200 ${
                        open ? "rotate-0" : "-rotate-90"
                    }`}
                />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
