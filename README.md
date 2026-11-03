# Archi Thrift

A marketplace for architecture student materials. Users register and list items
for sale; an admin approves or rejects each listing; approved items appear on a
public dashboard. Item photos are stored in Vercel Blob, app data and status
history are stored in Postgres, and login sessions are signed cookies.

## Features
- Public dashboard with search and category filters
- Registration and login with bcrypt password hashes
- Image listings with price, category, condition, description, and location
- Admin moderation, rejection reasons, and status history
- Mark listings sold and relist them later
- Optional WhatsApp enquiries and SMTP email notifications
- Responsive interface with a persistent theme preference

## Local development

Use Node.js 20. Install dependencies and prepare a Postgres database. A local
Postgres instance can be started with Docker:

```sh
docker run --name archi-thrift-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=archi_thrift \
  -p 5432:5432 -d postgres:16
```

Copy `.env.example` to `.env`, set `DATABASE_URL` and a stable `SESSION_SECRET`,
and set `ADMIN_PASSWORD` the first time the database needs an admin account.
Apply the schema and run the app:

```sh
npm install
npm run migrate
npm run dev
```

The app is available at `http://localhost:3000`. On the first request, an admin
account and the demo catalogue are seeded if the database is empty. Alternatively,
run `npm run seed` after migration. `ADMIN_PASSWORD` is only required when no
admin already exists.

## Configuration

Every supported environment variable is listed in `.env.example`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | Cookie signing key; required in production |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Initial admin account values |
| `ADMIN_WHATSAPP` | Optional international number, digits only |
| `CURRENCY` | Currency symbol shown with item prices |
| `EMAIL_ENABLED`, `EMAIL_FROM`, `EMAIL_ADMIN_TO` | Notification settings |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | SMTP connection settings |
| `BASE_URL` | Public origin used in email links; defaults to the Vercel deployment URL on Vercel |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token used for photo uploads and deletion |
| `PORT`, `NODE_ENV` | Local server port and runtime environment |

Email is logged instead of sent when `SMTP_HOST` is empty. When SMTP is
configured, notification sends are awaited for up to four seconds; mail errors do
not fail the marketplace action. Image uploads are limited to 4MB to fit within
Vercel's request-body limit.

## Deploy to Vercel

1. Provision a Postgres database with Neon or Vercel Postgres and copy its
  connection string into `DATABASE_URL`.
2. Create a Vercel Blob store and set its read/write token as
  `BLOB_READ_WRITE_TOKEN`.
3. Configure `SESSION_SECRET`, `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`
  in the Vercel project. Set `ADMIN_WHATSAPP`, SMTP values, and other optional
  settings as needed. `BASE_URL` can be omitted; Vercel's deployment URL is used.
4. Run the migration against the configured database:

  ```sh
  npm install
  npm run migrate
  ```

  Run this from a trusted local shell with the production `DATABASE_URL` set,
  or use the provider's SQL console to apply `schema.sql`. If the local legacy
  `data/db.json` exists and the target database is empty, the migration imports
  its users, listings, and status history. Set `BLOB_READ_WRITE_TOKEN` during
  migration to move any local `public/uploads/` photos into Blob as well.
5. Deploy the project. Vercel routes requests to `api/index.js`; static files are
  served from `public/`, and EJS templates are bundled from `views/`.

The initial admin and demo catalogue are created lazily on the first request if
the corresponding records are absent. Existing admin records do not require
`ADMIN_PASSWORD` to be set for startup.


