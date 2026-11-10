# Archi Thrift

Archi Thrift is a marketplace for architecture student materials. Visitors can
browse listings without an account. Users register to sell or contact sellers;
one admin account is created from environment settings and handles moderation.

## Architecture

- `app.js` builds the Express app and middleware for local and serverless use.
- `server.js` starts the app for local development; `config.js` loads environment settings.
- `api/index.js` adapts Vercel rewrites to the Express request path.
- `routes-api.js` exposes the homepage JSON API for session, listings, auth, and contact.
- `routes-items.js` handles item creation, seller actions, and admin moderation.
- `db.js` owns the pooled Postgres connection, schema bootstrap, and first-request seed.
- `schema.sql` defines users, items, and item history.
- `seed-data.js` provides the 26 demo listings; `mailer.js` sends optional status notifications.
- `public/index.html` and `public/js/marketplace.js` provide the static homepage and its API client; `public/` also holds styles, video, and other assets.
- `views/` contains the EJS pages for item details and authenticated workflows.
- `vercel.json` configures the serverless function, static output, and request rewrites.

## Environment

Copy `.env.example` to `.env` (or `.env.local`) for local development. The app
loads `.env.local` first and then `.env`; runtime environment variables take
precedence over both. Do not commit `.env` files or production credentials.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `SESSION_SECRET` | Yes | Signs the session cookie; required in production |
| `ADMIN_PASSWORD` | Yes, for first admin | Password used when creating the initial admin account |
| `ADMIN_EMAIL` | No | Initial admin email |
| `ADMIN_NAME` | No | Initial admin display name |
| `ADMIN_WHATSAPP` | No | International contact number, digits only |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob token for image uploads |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | No | SMTP notifications |
| `EMAIL_ENABLED`, `EMAIL_FROM`, `EMAIL_ADMIN_TO`, `BASE_URL` | No | Email notification settings |
| `CURRENCY`, `PORT`, `NODE_ENV` | No | Display and runtime settings |

## Local development

Use Node.js 24 and provide a reachable Postgres database in `DATABASE_URL`.
Then run:

```sh
npm install
npm run dev
```

On the first request, the app creates the schema, requires `ADMIN_PASSWORD` if
there is no admin yet, and seeds 26 demo listings from `seed-data.js` when the
items table is empty. Schema setup can also be run explicitly with
`npm run migrate`.

## Vercel

Set `DATABASE_URL`, `SESSION_SECRET`, and `ADMIN_PASSWORD` in the Vercel project
environment. Add `BLOB_READ_WRITE_TOKEN` to enable image uploads; WhatsApp and SMTP settings are optional. The Vercel function serves Express through
`api/index.js`, and `vercel.json` bundles the EJS views and routes page/API
requests to the function while leaving static files in `public/` to Vercel.

Vercel does not run a build command; the homepage loads its vanilla JavaScript
directly from `public/js/marketplace.js`. The legacy static preview can be
generated locally with `npm run build:static-preview`.


