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
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
          <Suspense fallback={null}>
            <ProgressBar />
          </Suspense>
        </ThemeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
