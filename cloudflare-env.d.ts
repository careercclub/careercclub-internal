interface CloudflareEnv {
  HYPERDRIVE?: {
    connectionString: string;
  };
  ASSETS?: Fetcher;
  AUTH_SECRET?: string;
  AUTH_URL?: string;
  AUTH_TRUST_HOST?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
