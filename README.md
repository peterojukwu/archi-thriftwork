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



