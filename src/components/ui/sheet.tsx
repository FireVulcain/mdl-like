"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A panel that comes in from the edge of the screen — the same Radix dialog
 * the modals use, anchored to a side instead of the middle. For work that is
 * done beside what it changes: the thing being edited stays on screen.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
    return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
    return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
    return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetContent({
    className,
    children,
    side = "right",
    showCloseButton = true,
    ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "right" | "left"; showCloseButton?: boolean }) {
    return (
        <SheetPrimitive.Portal>
            <SheetPrimitive.Overlay
                data-slot="sheet-overlay"
                className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            />
            <SheetPrimitive.Content
                data-slot="sheet-content"
                className={cn(
                    "fixed inset-y-0 z-50 flex h-dvh w-full max-w-md flex-col border-line-strong bg-panel shadow-2xl shadow-black/50 outline-none",
                    "transition ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
                    side === "right"
                        ? "right-0 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
                        : "left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
                    className,
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <SheetPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-fg-dim opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-line-strong cursor-pointer">
                        <XIcon className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </SheetPrimitive.Close>
                )}
            </SheetPrimitive.Content>
        </SheetPrimitive.Portal>
    );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="sheet-header" className={cn("flex flex-col gap-1 border-b border-line px-5 py-4", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="sheet-footer" className={cn("mt-auto flex items-center gap-2 border-t border-line px-5 py-3", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
    return <SheetPrimitive.Title data-slot="sheet-title" className={cn("font-display text-base font-semibold text-fg", className)} {...props} />;
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
    return <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-xs text-fg-dim", className)} {...props} />;
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger };
