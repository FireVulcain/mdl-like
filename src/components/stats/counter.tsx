"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        // Simple count up
        let start = 0;
        const end = value;
        if (start === end) return;

        let totalDuration = 1500;
        let increment = end / (totalDuration / 16);

        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setDisplayValue(end);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.floor(start));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [value]);

    return (
        <span>
            {displayValue.toLocaleString()}
            {suffix}
        </span>
    );
}
