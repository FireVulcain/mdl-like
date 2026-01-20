import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
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

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-900 font-sans`}
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            {isAuthenticated && <SiteHeader />}
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
        </Providers>
      </body>
    </html>
  );
}
