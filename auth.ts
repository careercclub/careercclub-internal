import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { timingSafeEqual } from "node:crypto";
import { authConfig } from "./auth.config";
import { getAuthUserByEmail, verifyPassword } from "@/lib/api/auth-users";

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
