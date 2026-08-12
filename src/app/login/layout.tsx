import type { Metadata } from "next";

/**
 * The login page is a client component, so it cannot export metadata itself —
 * Next rejects that at build time, and neither tsc nor eslint sees it. The
 * layout is the supported place for it.
 */
export const metadata: Metadata = {
    title: "Sign in",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
