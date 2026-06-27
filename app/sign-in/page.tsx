import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { signInWithCredentials } from "./actions";
import styles from "./sign-in.module.css";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export const metadata = {
  title: "Sign in",
};

function getErrorMessage(error?: string) {
  if (error === "credentials") {
    return "Email or password is incorrect.";
  }

  if (error) {
    return "Unable to sign in. Check the credentials and try again.";
  }

  return null;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorMessage = getErrorMessage(params.error);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>CCC</div>
        <div>
          <p className={styles.eyebrow}>CareerCclub Internal</p>
          <h1>Sign in to operations.</h1>
          <p className={styles.copy}>
            Use an active internal account from Postgres, or the bootstrap admin credentials
            configured in environment variables.
          </p>
        </div>

        {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}

        <form action={signInWithCredentials} className={styles.form}>
          <label>
            Email
            <input autoComplete="email" name="email" placeholder="admin@careercclub.com" type="email" required />
          </label>
          <label>
            Password
            <input autoComplete="current-password" name="password" placeholder="********" type="password" required />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </section>
    </main>
  );
}
