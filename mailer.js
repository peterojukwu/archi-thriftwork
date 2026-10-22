// Automated email notifications for listing status changes.
//
// Works out of the box with NO configuration: if no SMTP host is set (or the
// nodemailer package is missing) it runs in "log-only" mode and prints each
// notification to the console instead of sending a real email. Set the SMTP_*
// values in config.js (or the matching env vars) to send real mail.
//
// All sends are best-effort and non-blocking: a mail failure never breaks the
// request that triggered it.

const cfg = require('./config');

let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) { /* optional dependency */ }

let _transporter = null;
let _transporterTried = false;

function getTransporter() {
  if (_transporterTried) return _transporter;
  _transporterTried = true;
  if (!nodemailer || !cfg.EMAIL.SMTP_HOST) { _transporter = null; return null; }
  _transporter = nodemailer.createTransport({
    host: cfg.EMAIL.SMTP_HOST,
    port: cfg.EMAIL.SMTP_PORT,
    secure: cfg.EMAIL.SMTP_SECURE,
    auth: cfg.EMAIL.SMTP_USER ? { user: cfg.EMAIL.SMTP_USER, pass: cfg.EMAIL.SMTP_PASS } : undefined,
  });
  return _transporter;
}

const money = (n) => cfg.CURRENCY + Number(n || 0).toLocaleString();
const itemUrl = (item) => cfg.EMAIL.BASE_URL.replace(/\/$/, '') + '/item/' + item.id;
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Build the subject + plain-text + html body for a given status change.
// `status` is one of: submitted | approved | rejected | sold | relisted
function buildMessage(item, status, extra) {
  extra = extra || {};
  const name = item.title;
  let subject, intro, detail = '';
  switch (status) {
    case 'submitted':
      subject = `New listing awaiting review: “${name}”`;
      intro = `A new item has been submitted and is waiting for your approval.`;
      detail = `Seller: ${extra.sellerName || item.sellerName || 'Unknown'}\nPrice: ${money(item.price)}\nCategory: ${item.category}\nLocation: ${item.location || '—'}`;
      break;
    case 'approved':
      subject = `Your listing “${name}” is now live`;
      intro = `Good news — your item has been approved and is now visible on the Archi Thrift dashboard.`;
      break;
    case 'rejected':
      subject = `Your listing “${name}” was not approved`;
      intro = `Unfortunately your item was not approved this time.`;
      detail = `Reason: ${extra.reason || item.rejectReason || 'No reason provided.'}\n\nYou can edit the details and resubmit from your “My items” page.`;
      break;
    case 'sold':
      subject = `“${name}” has been marked as sold`;
      intro = `Your item has been marked as sold. It stays on the dashboard with a “Sold” badge; you can relist it any time from “My items”.`;
      break;
    case 'relisted':
      subject = `“${name}” is live again`;
      intro = `Your item has been relisted and is available for buyers again.`;
      break;
    default:
      subject = `Update on your listing “${name}”`;
      intro = `The status of your item changed to “${status}”.`;
  }

  const text = [
    intro,
    '',
    `Item: ${name}`,
    `Price: ${money(item.price)}`,
    detail,
    '',
    `View it: ${itemUrl(item)}`,
    '',
    '— Archi Thrift',
  ].filter(l => l !== undefined).join('\n');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#2b2b2b">
  <div style="background:#6E2D3B;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold">Archi Thrift</div>
  <div style="padding:20px;border:1px solid #eee;border-top:none">
    <p style="font-size:15px">${esc(intro)}</p>
    <table style="font-size:14px;border-collapse:collapse;margin:14px 0">
      <tr><td style="padding:4px 10px 4px 0;color:#777">Item</td><td style="padding:4px 0"><strong>${esc(name)}</strong></td></tr>
      <tr><td style="padding:4px 10px 4px 0;color:#777">Price</td><td style="padding:4px 0">${esc(money(item.price))}</td></tr>
    </table>
    ${detail ? `<p style="font-size:14px;white-space:pre-line;background:#faf6f7;border-left:3px solid #6E2D3B;padding:10px 14px">${esc(detail)}</p>` : ''}
    <p style="margin:20px 0"><a href="${esc(itemUrl(item))}" style="background:#6E2D3B;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px">View listing</a></p>
    <p style="font-size:12px;color:#999">You are receiving this because you have an Archi Thrift account. This is an automated message — please do not reply.</p>
  </div>
</div>`;

  return { subject, text, html };
}

// Fire a notification for a status change. `store` is the db module (to look up
// the seller's email). Returns a promise but callers can fire-and-forget.
async function notifyStatusChange(store, item, status, extra) {
  try {
    if (!cfg.EMAIL.ENABLED || !item) return;
    extra = extra || {};

    // Who should be told? Admin for "submitted", otherwise the seller.
    let to;
    if (status === 'submitted') {
      to = cfg.EMAIL.ADMIN_TO;
    } else {
      const seller = store.findUserById(item.sellerId);
      to = seller && seller.email;
    }
    if (!to) return;

    const { subject, text, html } = buildMessage(item, status, extra);
    const transporter = getTransporter();

    if (!transporter) {
      // Log-only mode (no SMTP configured) — keeps the app runnable with no setup.
      console.log(`[email] (log-only; SMTP not configured) to=${to} | ${subject}`);
      return;
    }
    await transporter.sendMail({ from: cfg.EMAIL.FROM, to, subject, text, html });
    console.log(`[email] sent to ${to} | ${subject}`);
  } catch (err) {
    console.error('[email] notification failed:', err && err.message);
  }
}

module.exports = { notifyStatusChange, buildMessage };
