import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import { Toaster } from "sonner";
import { SyncNotification } from "@/components/sync-notification";
import { CommandPalette } from "@/components/command-palette";
import { getNotificationPreferences, getMdlProfileUrl, getShortcutPreferences, getThemePreference } from "@/actions/preferences";

// Back on Geist, for both roles. font-display still exists as its own variable
// and is still what the 54 headings ask for — it simply resolves to the same
// face as the body for now, so swapping the display face later is one line here
// rather than a sweep across the app.
const sans = Geist({
  variable: "--font-sans-family",
  subsets: ["latin"],
});

const display = Geist({
  variable: "--font-display-family",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Pages return their bare subject; the template adds the suffix once. Without
  // it every page would have to remember to append " · trackr" itself.
  title: { default: "trackr", template: "%s · trackr" },
  description: "Track your movies and TV shows",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const skipAuth = process.env.SKIP_AUTH === "true";
  const session = await auth();
  const isAuthenticated = skipAuth || !!session;
  const [showSyncNotification, mdlProfileUrl, shortcuts, theme] = isAuthenticated
    ? await Promise.all([
        getNotificationPreferences().then((p) => p.showSyncNotification),
        getMdlProfileUrl(),
        getShortcutPreferences().then((p) => p.commandPaletteShortcuts),
        getThemePreference(),
      ])
    : [false, null, [], "dark" as const];

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${display.variable} ${geistMono.variable} antialiased min-h-screen bg-app text-fg font-sans`}
      >
        <Providers initialTheme={theme}>
          <div className="relative flex min-h-screen flex-col">
            {isAuthenticated && <SiteHeader mdlProfileUrl={mdlProfileUrl} paletteShortcut={shortcuts[0] ?? null} />}
            {isAuthenticated && <CommandPalette shortcuts={shortcuts} />}
            <main className={isAuthenticated ? "flex-1 pt-24" : "flex-1"}>{children}</main>
          </div>
          {/* Styled from globals.css rather than inline: the rules need per-type
              selectors for the severity edge, which a style object cannot express.
              richColors stays off — see the comment there. */}
          <Toaster position="top-right" theme="dark" toastOptions={{ classNames: { toast: "trackr-toast" } }} />
          {showSyncNotification && <SyncNotification />}
        </Providers>
      </body>
    </html>
  );
}
