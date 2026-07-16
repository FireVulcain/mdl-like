"use client";

// Shared labeled switch for settings panels
export function SettingToggle({
    checked,
    onChange,
    label,
    hint,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    hint?: string;
}) {
    return (
        <button onClick={() => onChange(!checked)} className="cursor-pointer flex items-center gap-3 group text-left">
            <span className={`relative shrink-0 h-6 w-11 rounded-full transition-colors ${checked ? "bg-blue-500" : "bg-white/10"}`}>
                <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        checked ? "left-5.5" : "left-0.5"
                    }`}
                />
            </span>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                {label}
                {hint && <span className="block text-xs text-gray-600">{hint}</span>}
            </span>
        </button>
    );
}
