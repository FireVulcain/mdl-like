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

      // Allow auth routes to pass through
      if (isAuthRoute) {
        return true;
      }

      // Redirect to login if not authenticated
      if (!isLoggedIn && !isLoginPage) {
        return false; // This will redirect to signIn page
      }

      // Redirect to home if already logged in and trying to access login
      if (isLoggedIn && isLoginPage) {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
    async jwt({ token, user, trigger, session: updatedSession }) {
      if (user) {
        token.id = user.id;
        token.image = user.image ?? null;
      }
      // Support client-side session.update({ image }) after avatar upload
      if (trigger === "update" && updatedSession?.image !== undefined) {
        token.image = updatedSession.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.image = (token.image as string | null | undefined) ?? null;
      }
      return session;
    },
  },
};
