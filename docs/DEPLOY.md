# Deploying Gramify to Railway

Gramify is a single Docker service plus a Postgres database. On Railway's Hobby plan this
costs about **$5–8 per month** for a team of 10–50 people.

## 1. Create the Google OAuth client (about 5 minutes)

Any Google account can sign in (Gmail or a company address). Signing in only gives someone an
empty library: **every board is private to the person who created it** until they share it from
**Share → People with access**.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project. A personal Google account is fine.
2. Open **Google Auth Platform → Branding** and fill in:
   - **App name:** `Gramify`
   - **User support email:** your email
   - **App logo:** leave it empty. Uploading a logo forces a Google verification review.
   - **Application home page:** `https://<your-domain>`
   - **Application privacy policy link:** `https://<your-domain>/privacy` (built into the app)
   - **Application terms of service link:** `https://<your-domain>/terms` (built into the app)
   - **Authorized domains:** `<your-domain>`, e.g. `gramify.up.railway.app`
   - **Developer contact information:** your email
3. Open **Audience**:
   - Set the user type to **External**.
   - Click **Publish app** so the status is **In production**. The app only asks for basic profile and
     email, so Google doesn't require a review for this. People may see an "unverified app" note until
     you verify the brand, which is optional.
   - Leaving it in **Testing** also works, but then only the people you list under **Test users** (up to 100)
     can sign in. That's a handy extra gate if you want one.
4. Open **Clients → Create client → Web application**:
   - **Authorized JavaScript origins:** `https://<your-domain>`
   - **Authorized redirect URIs:** `https://<your-domain>/api/auth/callback/google`

   You don't know the domain until step 2 below, so it's fine to come back and fill these in afterwards.

5. Copy the **Client ID** and **Client secret**.

If your company _does_ use Google Workspace and you want only company accounts to sign in, set
`ALLOWED_GOOGLE_DOMAIN=yourcompany.com`. Gramify then also verifies the signed `hd` (hosted domain)
claim from Google.

### Who can see what

|                                                       | Owner (creator) | Added with "Can edit" | Added with "Can view" | Everyone else                   |
| ----------------------------------------------------- | --------------- | --------------------- | --------------------- | ------------------------------- |
| Open the board, see live cursors, export              | ✓               | ✓                     | ✓                     | ✗ (looks like it doesn't exist) |
| Edit the diagram and title, save and restore versions | ✓               | ✓                     | ✗                     | ✗                               |
| Add or remove people, change access                   | ✓               | ✗                     | ✗                     | ✗                               |
| Move to a folder, trash, delete, delete versions      | ✓               | ✗                     | ✗                     | ✗                               |
| Duplicate into their own private copy                 | ✓               | ✓                     | ✓                     | ✗                               |
| Leave the board                                       | –               | ✓                     | ✓                     | –                               |

- People are added by email and can be added **before** they've ever signed in.
- Removing someone or changing their access takes effect immediately, even if they have the board open.
- Folders are personal: each person organises their own boards, and boards shared with you appear under **Shared with me**.

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
   | `ALLOWED_GOOGLE_DOMAIN` | _optional_: only if you want to restrict sign-in to a Google Workspace domain               |

   Optionally set `MAX_BOARDS_PER_USER` (default `5`, boards each person may own including their trash; `0` = unlimited). Optionally add `CONTACT_EMAIL` (shown on the privacy and terms pages). Railway sets `PORT` for you. **Do not** set `DEV_LOGIN` in production; it is ignored there anyway.

5. Check that **Settings → Deploy → Serverless / App Sleeping** is **off**, and that replicas is **1**.
   Live collaboration keeps open documents in the server's memory, so the service has to stay awake
   and run as a single instance. `railway.json` already sets both.
6. Deploy. Database migrations run automatically when the service starts. The health check is `GET /api/health`.

Now go back to Google Cloud and fill in the origin and redirect URI from step 1.4 using the real domain.

## 3. Operations

- **Backups:** the diagrams live in Postgres (the `diagram` and `diagram_version` tables). Use Railway's
  database backups if your plan includes them, or run a scheduled
  `pg_dump "$DATABASE_URL" > gramify-$(date +%F).sql`.
- **Updates:** push to the deployed branch and Railway rebuilds. During a redeploy, connected editors
  show "Reconnecting…" for a few seconds. Their edits are kept locally and merge when they reconnect.
- **Logs:** the service logs migrations, startup, and pruning of old automatic versions (hourly).
- **Scaling:** one instance easily handles a team. If you ever need more than one replica, add
  `@hocuspocus/extension-redis` so the instances share document updates.

## Running the production image locally

```bash
docker compose --profile app up --build
```

Then open http://localhost:3000. For Google sign-in, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
in your shell, and add `http://localhost:3000/api/auth/callback/google` as a redirect URI
on the OAuth client.
