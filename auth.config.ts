import type { NextAuthConfig } from "next-auth";
import { safeNextPath } from "@/lib/auth/next-path";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isSignInPage = request.nextUrl.pathname === "/sign-in";

      if (isSignInPage && isLoggedIn) {
        // Already signed in: go where sign-in was asked for (e.g. connecting Claude), else the dashboard.
        return Response.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get("callbackUrl")) || "/dashboard", request.nextUrl.origin));
      }

      return isSignInPage || isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
