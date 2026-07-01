# VPS Production Deployment

The production application runs as a standalone Next.js container on the same Docker network as
the existing PostgreSQL service. Caddy is the only public application entry point. PostgreSQL
remains bound to VPS loopback and is not exposed to the Internet.

## Architecture

```text
Cloudflare DNS (internal.ccclub.id)
  -> existing Caddy container (ports 80/443)
  -> ccc-ops-web:3000 on deploy_default
  -> postgres:5432 on deploy_default
```

## 1. Production Environment

Create `.env.production` beside `docker-compose.production.yml`. Do not commit this file.

```dotenv
DATABASE_URL=postgres://ccc_ops_app:URL_ENCODED_PASSWORD@postgres:5432/ccc_ops
POSTGRES_MAX_CONNECTIONS=10
POSTGRES_PREPARE=true

AUTH_SECRET=GENERATE_A_RANDOM_SECRET
AUTH_URL=https://internal.ccclub.id
AUTH_TRUST_HOST=true

NEXT_PUBLIC_GOOGLE_CLIENT_ID=

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

RESEND_API_KEY=
RESEND_FROM_EMAIL=

R2_ACCOUNT_ID=a9b5e021190b0de7e50fbd286efdaa4f
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=ccc-ops
R2_PUBLIC_BASE_URL=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@ccclub.id
```

Generate `AUTH_SECRET` with:

```bash
openssl rand -base64 48
```

Generate the Web Push VAPID key pair once and keep both values stable across deployments:

```bash
npx web-push generate-vapid-keys
```

Changing the VAPID key pair invalidates existing browser subscriptions. Push permission is always
requested from the notification panel after an authenticated user explicitly selects Enable push.

Percent-encode reserved characters in the database password before placing it in a URL.

## 2. Build And Start

The existing `deploy_default` network must exist before the application starts.

Apply every migration that has not already been recorded on this database. For the current parity
release, `005` is the final migration:

```bash
docker exec -i deploy-postgres-1 \
  psql -U ccc_user -d ccc_ops -v ON_ERROR_STOP=1 \
  < database/migrations/005_workflow_integrity.sql
```

When Google Calendar is enabled, create a Google OAuth Web client and add both the local origin and
`https://internal.ccclub.id` to its Authorized JavaScript origins. Put the client ID in
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`; no Google client secret is used by this browser-consent flow.

```bash
docker network inspect deploy_default >/dev/null
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 web
```

The Compose project adds the stable `ccc-ops-web` alias to `deploy_default`. It does not publish
port 3000 on the VPS.

## 3. Caddy

Add this site block to `/opt/ccc/deploy/Caddyfile` without changing the existing sites:

```caddyfile
internal.ccclub.id {
  encode zstd gzip
  reverse_proxy ccc-ops-web:3000
}
```

Validate and reload the existing Caddy container:

```bash
cd /opt/ccc/deploy
docker exec deploy-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec deploy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## 4. Cloudflare DNS

Create one proxied DNS record in the `ccclub.id` zone:

```text
Type: A
Name: internal
Content: <VPS_PUBLIC_IP>
Proxy status: Proxied
TTL: Auto
```

Do not change the existing apex `ccclub.id` shortlink records or Worker routes.

## 5. Verification

Check connectivity from the existing Caddy container before switching DNS:

```bash
docker exec deploy-caddy-1 wget -qO- http://ccc-ops-web:3000/api/health
```

Expected response:

```json
{"status":"ok"}
```

After DNS and TLS are active:

```bash
curl -fsS https://internal.ccclub.id/api/health
curl -I https://internal.ccclub.id/sign-in
```

## Updating

```bash
git pull
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
docker image prune -f
```

## Rollback

Redeploy the previous Git commit or image, then run:

```bash
docker compose -f docker-compose.production.yml up -d --no-build
```
