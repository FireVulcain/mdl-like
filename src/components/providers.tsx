'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from "next-auth/react";
import { useState, Suspense } from 'react';
import { ThemeProvider } from "next-themes";
import { ProgressBar } from '@/components/progress-bar';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }));

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {/* Still attribute="class". Tailwind's dark variant is defined as
              &:is(.dark *) and seventeen shadcn primitives rely on it, so
              moving to a data attribute would have quietly unstyled all of
              them. The theme tokens key on :root.light to match.

              enableSystem is off, which is a change: it was on while there was
              no light theme to resolve to, and would now hand a light-desktop
              visitor a theme they never asked this site for. The dark is this
              site's identity; the toggle is the way out of it. */}
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <Suspense fallback={null}>
            <ProgressBar />
          </Suspense>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
