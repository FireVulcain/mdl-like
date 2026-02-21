import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// Skip auth when SKIP_AUTH is set to "true"
const skipAuth = process.env.SKIP_AUTH === "true";

export default skipAuth
    ? () => NextResponse.next()
    : auth;

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         * - api/cron/* (cron jobs use their own auth)
         */
        "/((?!_next/static|_next/image|favicon.ico|api/cron|api/ping|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
