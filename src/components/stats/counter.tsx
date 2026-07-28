"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 1500;
const FRAME_MS = 16;

export function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
    const [displayValue, setDisplayValue] = useState(0);
    // Derived, not stored: an extra setState in the effect body would trigger a
    // cascading render, and this says exactly the same thing.
    const animating = displayValue !== value;

    useEffect(() => {
        if (value === 0) return;

        let current = 0;
        const increment = value / (DURATION_MS / FRAME_MS);

        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.floor(current));
            }
        }, FRAME_MS);

        return () => clearInterval(timer);
    }, [value]);

    return (
        // tabular-nums only while the digits are still changing: it stops the
        // number jittering mid-count. It comes off once settled, because
        // equal-width digits make a large standalone figure look loose.
        <span className={animating ? "tabular-nums" : undefined}>
            {/* Explicit locale. Without one this follows the *browser's*, so a
                French visitor read "1 234" here and "1,234" everywhere else. */}
            {displayValue.toLocaleString("en-US")}
            {suffix}
        </span>
    );
}
