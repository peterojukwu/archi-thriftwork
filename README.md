# Archi Thrift

A marketplace for architecture student materials. Users register and list items
for sale; an admin approves or rejects each listing; approved items appear on a
public dashboard that anyone can browse without logging in. Enquiries about an
item open the admin's WhatsApp with a pre-filled message. The admin can also
post items directly (auto-approved).

## Features
- Public dashboard of approved listings (no login required) with search + category filter
- User registration & login (passwords hashed with bcrypt, server-side sessions)
- Sellers upload items with photo, price, category, condition, description, and **location (required)**
- Admin moderation dashboard: approve / reject / unpublish / delete, with counts
- **Rejection reasons** — when an admin rejects a listing they enter a reason, which is shown back to the seller on their "My items" page
- **Status tracking & history** — every listing records a timeline (submitted / approved / rejected / sold / relisted) visible to the seller and admin
- **Mark as sold / relist** — sellers (and admin) can mark an item sold; sold items stay on the dashboard with a "Sold" badge and the enquiry button is hidden, and can be relisted later
- Admin-posted items are published immediately
- "Enquire on WhatsApp" button -> `wa.me` link to the admin number, pre-filled with the item details
- **Dark mode** — a theme toggle in the header; the choice is remembered across visits
- **Automated email notifications** — sellers are emailed when their listing changes status (approved / rejected — with the admin's reason / sold / relisted), and the admin is emailed when a new item is submitted for review. Runs in “log-only” mode with no setup; add SMTP details to send real email
- Seeded with 26 demo listings (category placeholder graphics, no uploaded photos) so the dashboard looks populated on first run
- Responsive, brand-matched UI (Archi Thrift burgundy + logo)

## Tech
Node.js + Express + EJS, server-side sessions, Multer for image uploads, bcryptjs
for passwords. Data is stored in a simple JSON file (`data/db.json`) and uploaded
images in `public/uploads/` — no database server or native build step required.
## Run it
```bash
npm install
npm start
```
Then open http://127.0.0.1:3000

The first run seeds a default admin account (see below).

## Configuration
Edit `config.js` or set environment variables:

| Setting | Env var | Default |
|---|---|---|
| Server port | `PORT` | `3000` |
| Session secret | `SESSION_SECRET` | dev value (change for production) |
| **Admin WhatsApp number** | `ADMIN_WHATSAPP` | `2348000000000` |
| Admin name | `ADMIN_NAME` | `Archi Thrift Admin` |
| Admin email | `ADMIN_EMAIL` | `admin@archithrift.com` |
| Admin password | `ADMIN_PASSWORD` | `admin123` |
| Currency symbol | `CURRENCY` | `₦` |

> **Important:** set `ADMIN_WHATSAPP` to the store's real number in international
> format, digits only (no `+`, spaces or dashes). Example: `2348031234567`.

### Email notifications
Sellers get an automatic email when their listing is approved, rejected (with the
admin's reason), marked sold, or relisted; the admin is emailed when a new item is
submitted for review. Configure the SMTP transport with env vars (or edit the
`EMAIL` block in `config.js`):

| Setting | Env var | Default |
|---|---|---|
| Turn notifications on/off | `EMAIL_ENABLED` | `true` |
| “From” header | `EMAIL_FROM` | `Archi Thrift <no-reply@archithrift.com>` |
| Where “new item” alerts go | `EMAIL_ADMIN_TO` | admin email |
| Link base URL in emails | `BASE_URL` | `http://127.0.0.1:<PORT>` |
| SMTP host | `SMTP_HOST` | _(empty → log-only mode)_ |
| SMTP port | `SMTP_PORT` | `587` |
| SMTP TLS (port 465) | `SMTP_SECURE` | `false` |
| SMTP username | `SMTP_USER` | _(empty)_ |
| SMTP password | `SMTP_PASS` | _(empty)_ |

> If `SMTP_HOST` is empty the app runs in **log-only mode**: it still works and
> prints each notification to the console instead of sending real mail — handy
> for development. Fill in the SMTP values (e.g. your provider or a service like
> Mailgun/SendGrid/SES) to send real email. Sends are non-blocking and a mail
> failure never breaks the action that triggered it.

### Default admin login
- Email: `admin@archithrift.com`
- Password: `admin123`

Change these before deploying (set the env vars, then delete `data/db.json` so a
fresh admin is seeded, or update the record).

## Notes & next steps
- The JSON file store is great for a demo or small store. For heavier use, swap
  `db.js` for a real database (PostgreSQL, SQLite, MongoDB).
- For production: run behind HTTPS, set a strong `SESSION_SECRET`, enable the
  `secure` cookie flag, and use a persistent session store.


