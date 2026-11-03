# Archi Thrift

Archi Thrift is a marketplace for architecture student materials. The current
Vercel deployment is a public, static frontend with the generated catalog design
and original video hero. Listings are generated from `seed-data.js` at build time.

## Current frontend

- Visitors can browse, search, and filter listings without an account.
- Item details are public; selling and contacting a seller lead to login/register.
- Login and registration forms are visual previews. They do not create accounts,
  authenticate users, or store submitted details.
- The single-admin and multiple-user account system is not connected yet.

## Build and deploy

Use Node.js 26:

```sh
npm install
npm run build
```

The build keeps the custom homepage, generates catalog data and demo item pages,
and prerenders login/register pages into `public/`. Vercel runs this build through
`vercel.json`; browsing the current frontend does not require Postgres or
production environment variables.

## Backend status

The Express, Postgres, session, and upload code is not used by the current
static Vercel deployment. Real registration/login, one admin account, multiple
user accounts, persisted listings, and uploads still require backend integration
and a provisioned Postgres database and Blob store.


