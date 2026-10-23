import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The pieces the settings page is built from. One page of six groups, each a
 * plain box of rows: what the setting is on the left, the control on the
 * right. Controls carry no colour of their own — a switch that is on reads by
 * its fill, a chosen option by the step it sits on — so nothing here competes
 * with the rest of the site's accents.
 */

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={cn("relative block h-5 w-8.5 shrink-0 rounded-full transition-colors cursor-pointer", checked ? "bg-fg" : "bg-surface-4")}
        >
            <span
                className={cn(
                    "absolute top-0.5 size-4 rounded-full transition-all",
                    checked ? "left-4 bg-page" : "left-0.5 bg-fg-muted",
                )}
            />
        </button>
    );
}

export function SegmentedRail<T extends string>({
    options,
    value,
    onChange,
    label,
}: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (next: T) => void;
    label: string;
}) {
    return (
        <div role="radiogroup" aria-label={label} className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-surface-2 p-0.75">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={opt.value === value}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        "h-7 px-2.5 rounded-md text-[13px] whitespace-nowrap transition-colors cursor-pointer",
                        opt.value === value ? "bg-surface-4 font-medium text-fg" : "text-fg-muted hover:text-fg",
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/**
 * One setting. `wide` is for the controls that are a list or a form rather
 * than a single switch: they drop under their label and take the full width.
 */
export function SettingRow({ label, hint, wide = false, children }: { label: string; hint?: ReactNode; wide?: boolean; children: ReactNode }) {
    return (
        <div className={cn("grid gap-x-6 gap-y-2 py-4 items-center", wide ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto]")}>
            <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{label}</p>
                {hint && <p className="mt-0.5 max-w-[60ch] text-[13px] text-fg-dim">{hint}</p>}
            </div>
            <div className={cn("min-w-0", wide ? "mt-1" : "flex sm:justify-end")}>{children}</div>
        </div>
    );
}

export function SettingsGroup({
    id,
    title,
    description,
    after,
    children,
}: {
    id: string;
    title: string;
    description: string;
    after?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section id={id} data-settings-group={id} className="scroll-mt-28">
            <div className="mb-3">
                <h2 className="font-display text-[17px] font-semibold tracking-tight text-fg">{title}</h2>
                <p className="mt-0.5 text-[13px] text-fg-dim">{description}</p>
            </div>
            <div className="rounded-lg bg-box px-4.5 divide-y divide-line-soft">{children}</div>
            {after && <div className="mt-2.5">{after}</div>}
        </section>
    );
}

export const settingsInput =
    "h-8.5 w-full rounded-md bg-surface-2 px-2.5 text-[13px] text-fg placeholder:text-fg-faint outline-none focus:ring-1 focus:ring-line-strong";

export const settingsButton =
    "h-8 shrink-0 cursor-pointer rounded-md bg-fg px-3 text-[13px] font-semibold text-page transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30";

export const settingsLink = "cursor-pointer text-[13px] text-fg-dim transition-colors hover:text-fg disabled:opacity-50";
