"use client";

import { useRef, useEffect, useState } from "react";

export function StickySidebar({ children }: { children: React.ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [top, setTop] = useState(96);
    const [sticky, setSticky] = useState(true);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            if (window.innerWidth < 768) {
                setSticky(false);
                return;
            }

            setSticky(true);

            const headerHeight = 96;
            const bottomGap = 24;
            const elHeight = el.offsetHeight;

            setTop(Math.min(headerHeight, window.innerHeight - elHeight - bottomGap));
        };

        const ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener("resize", update);
        update();

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", update);
        };
    }, []);

    return (
        <div
            ref={ref}
            style={{
                position: sticky ? "sticky" : "static",
                top: sticky ? top : undefined,
                alignSelf: "start",
            }}
            className="space-y-3 md:space-y-4 pb-2 md:pb-6"
        >
            {children}
        </div>
    );
}
