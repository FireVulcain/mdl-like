'use client';

import { useRef, useEffect, useState } from 'react';

export function StickySidebar({ children }: { children: React.ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [top, setTop] = useState(96);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            const headerHeight = 96;
            const bottomGap = 24;
            const elHeight = el.offsetHeight;
            // Stick when the bottom of the sidebar (+ gap) is at the bottom of the viewport,
            // but never push the top higher than the header
            setTop(Math.min(headerHeight, window.innerHeight - elHeight - bottomGap));
        };

        const ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener('resize', update);
        update();

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
        };
    }, []);

    return (
        <div ref={ref} style={{ position: 'sticky', top, alignSelf: 'start' }} className="space-y-4 pb-6">
            {children}
        </div>
    );
}
