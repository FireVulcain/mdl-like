import type { NextAuthConfig } from "next-auth";

// Edge-compatible config (no Node.js dependencies like bcrypt or Prisma)
export const authConfig: NextAuthConfig = {
  providers: [], // Providers will be added in the full auth.ts
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      const isAuthRoute = nextUrl.pathname.startsWith("/api/auth");
      // Public profiles are readable without an account (visibility is
      // enforced by the page itself via the owner's preferences)
      const isPublicProfile = nextUrl.pathname.startsWith("/u/");

      // Allow auth routes to pass through
      if (isAuthRoute || isPublicProfile) {
        return true;
      }

      // Redirect to login if not authenticated, carrying where they were
      // headed. Returning false alone loses it: a bookmarked media page sends
      // you to the login form and then, once through, to the home page — the
      // one place you were not asking for.
      if (!isLoggedIn && !isLoginPage) {
        const target = nextUrl.pathname + nextUrl.search;
        const login = new URL("/login", nextUrl);
        // Not worth carrying when it is where they would land anyway.
        if (target !== "/") {
          login.searchParams.set("callbackUrl", target);
        }
        return Response.redirect(login);
      }

      // Redirect to home if already logged in and trying to access login
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
