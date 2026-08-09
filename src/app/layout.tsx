import type { Metadata } from "next";
import { Instrument_Sans, Newsreader, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import { Toaster } from "sonner";
import { SyncNotification } from "@/components/sync-notification";
import { getNotificationPreferences, getMdlProfileUrl } from "@/actions/preferences";

// The interface runs on Instrument Sans. The site was on Geist, which is what
// create-next-app installs — the most common choice there is.
const sans = Instrument_Sans({
  variable: "--font-sans-family",
  subsets: ["latin"],
});

// Every title on the site, hero and section headings alike. One display face,
// not two: a serif that showed up once at the top of the page and nowhere else
// read as an accident rather than a decision.
const display = Newsreader({
  variable: "--font-display-family",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "trackr",
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
  const [showSyncNotification, mdlProfileUrl] = isAuthenticated
    ? await Promise.all([
        getNotificationPreferences().then((p) => p.showSyncNotification),
        getMdlProfileUrl(),
      ])
    : [false, null];

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${display.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-900 font-sans`}
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            {isAuthenticated && <SiteHeader mdlProfileUrl={mdlProfileUrl} />}
            <main className={isAuthenticated ? "flex-1 pt-24" : "flex-1"}>{children}</main>
          </div>
          <Toaster
            position="top-right"
            theme="dark"
            richColors
            toastOptions={{
              style: {
                background: "rgba(31, 41, 55, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(8px)",
              },
            }}
          />
          {showSyncNotification && <SyncNotification />}
        </Providers>
      </body>
    </html>
  );
}
