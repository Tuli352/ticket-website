# Ne-Yo Live — Ticket Sales Site

React + Node/Express + MySQL. Compact file structure, M-Pesa STK Push (Daraja),
card, and bank transfer, with an 8-hour sales window enforced **server-side**.

## What "8-hour window" means here

- Sales close automatically after `event_settings.sales_close_at` — enforced by
  the `requireSalesOpen` middleware on every purchase route, not just the UI
  countdown, so it can't be bypassed client-side.
- A cron job in `server.js` also flips `event_settings.status` to `closed`
  as a belt-and-braces check.
- **Orders, payments, and tickets are never deleted.** Keep the database (and
  hosting, if practical) up after the window closes so you can issue refunds,
  resolve M-Pesa/card disputes, and re-send tickets that failed to email.
  If you want the *frontend* offline afterward, that's fine — just don't tie
  data deletion to it.

## Setup

### Database
```bash
mysql -u root -p < database/schema.sql
```

### Backend
```bash
cd backend
cp .env.example .env   # fill in Daraja keys, DB creds, SMTP
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Before going live

- Get your Daraja app approved (or use an aggregator — IntaSend/Pesapal/
  Paystack/Flutterwave — for faster setup and one dashboard across M-Pesa,
  cards, and bank).
- Wire `services/payments.js`'s card branch to your real processor's
  hosted checkout.
- Add real admin auth in front of `/api/admin/*` routes.
- Whitelist Safaricom's callback IPs if your host supports it.
- Test the full sandbox flow: success, cancelled PIN, insufficient funds,
  wrong number, card decline, bank reference mismatch.
- Publish a visible refund policy and real contact details — this matters
  both for customer trust and for staying in good standing with your
  payment processor.
