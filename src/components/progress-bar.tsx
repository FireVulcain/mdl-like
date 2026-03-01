'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'completing'>('idle');

  // Complete the progress bar when route changes
  useEffect(() => {
    if (state === 'loading') {
      setState('completing');
      const timeout = setTimeout(() => {
        setState('idle');
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor) {
        const href = anchor.getAttribute('href');
        const targetAttr = anchor.getAttribute('target');

        // Only trigger for internal navigation
        if (
          href &&
          href.startsWith('/') &&
          !targetAttr &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey
        ) {
          // Don't trigger if href resolves to the exact same URL (same path + same query)
          const currentFull = window.location.pathname + window.location.search;
          if (href !== currentFull) {
            setState('loading');
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);

    return () => {
      document.removeEventListener('click', handleAnchorClick);
    };
  }, []);

  if (state === 'idle') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 99999,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          background: '#3b82f6',
          boxShadow: '0 0 10px #3b82f6, 0 0 5px #3b82f6',
          width: state === 'completing' ? '100%' : '0%',
          animation: state === 'loading'
            ? 'progress-loading 2s ease-out forwards'
            : state === 'completing'
            ? 'progress-complete 0.2s ease-out forwards'
            : 'none',
        }}
      />
      <style jsx>{`
        @keyframes progress-loading {
          0% { width: 0%; }
          10% { width: 20%; }
          30% { width: 50%; }
          50% { width: 70%; }
          70% { width: 80%; }
          90% { width: 85%; }
          100% { width: 90%; }
        }
        @keyframes progress-complete {
          from { width: 90%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
