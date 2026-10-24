import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import { authConfig } from "./auth.config";
import { getAuthUserAccess, getAuthUserByEmail, verifyPassword } from "@/lib/api/auth-users";
import { createAccessCheck } from "@/lib/auth/access";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Shared with user-actions so a change made in Settings applies at once on this server. */
export const accessCheck = createAccessCheck((id) => (UUID.test(id) ? getAuthUserAccess(id) : Promise.resolve(null)));

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePassword(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function authorizeInternalUser(email: string, password: string) {
  const bootstrapEmail = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.AUTH_ADMIN_PASSWORD;

  if (
    bootstrapEmail &&
    bootstrapPassword &&
    safeEqual(email, bootstrapEmail) &&
    safeEqual(password, bootstrapPassword)
  ) {
    return {
      id: "env-admin",
      email,
      name: "CCC Admin",
      role: "admin",
    };
  }

  const user = await getAuthUserByEmail(email);

  if (!user || user.is_active === false) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, user.password_hash);

  if (!isValidPassword) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email,
    role: user.role || "member",
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // While signed in: a Blocked or removed account loses its session (within a minute), and a
    // role change applies without signing in again. The bootstrap admin from the environment is
    // not in the database and is left as is.
    async jwt(params) {
      const token = authConfig.callbacks.jwt(params);
      if (params.user) return token;
      const id = String(token.id || "");
      if (!id || id === "env-admin") return token;
      try {
        const access = await accessCheck.check(id);
        if (!access) return null;
        token.role = access.role;
      } catch (error) {
        // Database unreachable: keep the session rather than signing everyone out; the page
        // queries fail on their own and access is re-checked on the next request.
        console.warn("[auth] access check failed", error instanceof Error ? error.message : error);
      }
      return token;
    },
  },
  providers: [
    Credentials({
      name: "CareerCclub Internal",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email);
        const password = normalizePassword(credentials?.password);

        if (!email || !password) {
          return null;
        }

        return authorizeInternalUser(email, password);
      },
    }),
  ],
});
