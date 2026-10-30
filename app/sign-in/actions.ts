"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/next-path";

export async function signInWithCredentials(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      // Back to where sign-in was asked for (e.g. connecting Claude), else the dashboard.
      redirectTo: safeNextPath(formData.get("next")) || "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const errorType = error.type === "CredentialsSignin" ? "credentials" : "default";
      const next = safeNextPath(formData.get("next"));
      redirect(`/sign-in?error=${errorType}${next ? `&callbackUrl=${encodeURIComponent(next)}` : ""}`);
    }

    throw error;
  }
}
