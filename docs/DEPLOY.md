# Deploying Tidepool to Railway

Tidepool is a single Docker service plus a Postgres database. On Railway's Hobby plan this
costs about **$5–8 per month** for a team of 10–50 people.

## 1. Create the Google OAuth client (about 5 minutes)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project, or pick an existing one,
   **inside your company's Google Workspace organization**.
2. Open **Google Auth Platform → Branding** and fill in the app name (e.g. "Tidepool") and the support email.
3. Open **Audience** and set the user type to **Internal**. Only accounts in your Workspace can then sign in,
   and Google does not need to verify the app.
4. Open **Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** `https://<your-domain>`
   - **Authorized redirect URIs:** `https://<your-domain>/api/auth/callback/google`

   You don't know the domain until step 2 below, so it's fine to come back and fill these in afterwards.

5. Copy the **Client ID** and **Client secret**.

Tidepool also checks the verified `hd` (hosted domain) claim in Google's ID token against
`ALLOWED_GOOGLE_DOMAIN`, so sign-ins from other domains are rejected even if the consent screen were public.

## 2. Create the Railway project

1. In [Railway](https://railway.com): **New Project → Deploy from GitHub repo**, then pick this repository.
   Railway finds `railway.json` and builds the `Dockerfile`.
2. Add the database: **+ New → Database → PostgreSQL**.
3. On the app service, open **Settings → Networking → Generate Domain**, or add your own domain
   (Hobby allows 2 custom domains per service). That URL is your `<your-domain>`.
4. On the app service, open **Variables** and add:

   | Variable                | Value                                                                                       |
   | ----------------------- | ------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`          | `${{Postgres.DATABASE_URL}}` (a Railway reference variable, which uses the private network) |
   | `BETTER_AUTH_URL`       | `https://<your-domain>`, exactly the public origin, with no trailing slash                  |
   | `BETTER_AUTH_SECRET`    | a random string: `openssl rand -base64 32`                                                  |
   | `GOOGLE_CLIENT_ID`      | from step 1                                                                                 |
   | `GOOGLE_CLIENT_SECRET`  | from step 1                                                                                 |
   | `ALLOWED_GOOGLE_DOMAIN` | your Workspace domain, e.g. `acme.com` (comma-separate several)                             |

   Railway sets `PORT` for you. **Do not** set `DEV_LOGIN` in production; it is ignored there anyway.

5. Check that **Settings → Deploy → Serverless / App Sleeping** is **off**, and that replicas is **1**.
   Live collaboration keeps open documents in the server's memory, so the service has to stay awake
   and run as a single instance. `railway.json` already sets both.
6. Deploy. Database migrations run automatically when the service starts. The health check is `GET /api/health`.

Now go back to Google Cloud and fill in the origin and redirect URI from step 1.4 using the real domain.

## 3. Operations

- **Backups:** the diagrams live in Postgres (the `diagram` and `diagram_version` tables). Use Railway's
  database backups if your plan includes them, or run a scheduled
  `pg_dump "$DATABASE_URL" > tidepool-$(date +%F).sql`.
- **Updates:** push to the deployed branch and Railway rebuilds. During a redeploy, connected editors
  show "Reconnecting…" for a few seconds. Their edits are kept locally and merge when they reconnect.
- **Logs:** the service logs migrations, startup, and pruning of old automatic versions (hourly).
- **Scaling:** one instance easily handles a team. If you ever need more than one replica, add
  `@hocuspocus/extension-redis` so the instances share document updates.

## Running the production image locally

```bash
docker compose --profile app up --build
```

Then open http://localhost:3000. For Google sign-in, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
`ALLOWED_GOOGLE_DOMAIN` in your shell, and add `http://localhost:3000/api/auth/callback/google` as a redirect URI
on the OAuth client.
