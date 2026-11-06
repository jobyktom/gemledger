# Database (Supabase)

Hosted project: `gemledger-mumbai` (ref `rikpwgvbnrbyaolfduug`, region `ap-south-1` Mumbai), so Indian customer data stays in India. Both migrations below are already applied there.

The free plan pauses a project after a week without activity, so `.github/workflows/supabase-keepalive.yml` runs a tiny read-only query twice a week. Delete it once we go live on a paid plan.

## Migrations

SQL files in `migrations/` are applied in name order. The first one creates:

- `shops`, `shop_members`: jewellers and their staff (owner, manager, staff). New shops start
  `pending`; only GemLedger admins (service role) can approve them.
- `items`, `item_huids`, `grading_reports`, `documents`: the jewellery and its evidence.
- `passports`: QR-linked passports with an unguessable 22-character `public_id`. Only approved
  shops can issue them, and each item has at most one live passport.
- `get_public_passport(public_id)`: the only way the public verify page reads data. It returns
  shop, item basics, HUIDs and report statuses, never price or owner.
- A private `item-files` storage bucket; files live under `<shop_id>/<item_id>/…`.

Later migrations add `platform_admins` (GemLedger staff, added by hand in the SQL editor) and,
in `20261106130000_admin_dashboard.sql`, read-only access for those admins to every shop's data
plus the dashboard functions `admin_shop_stats()`, `admin_weekly_passports()` and
`admin_shop_members()`. Admins can read everything but still only change a shop's status.

Row-level security is on for every table: a user only sees rows for shops they belong to.
Shops can record lab reports as `uploaded` but cannot mark them `lab_matched`; only the
server-side lab connector can.

## Tests

`tests/rls_test.sql` checks tenant isolation, shop approval, self-verification and the public
verify function. It runs inside a transaction and rolls back. Run it against a local or branch
database (never production):

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_test.sql
```

## Phone sign-in (one-time setup in the dashboard)

Jewellers sign in with an SMS code. In **Authentication → Sign In / Providers → Phone**:

1. Turn on **Enable phone provider** and choose an SMS provider (Twilio, MessageBird, Textlocal
   or Vonage) with its credentials. Indian SMS needs a DLT-registered sender and template.
2. For development, add **test phone numbers** with fixed codes (e.g. `919999900001=123456`)
   so you can sign in without sending real SMS.

## Email sign-in

The login page also offers email with a one-time code.

1. Authentication → Sign In / Providers → Email: enabled (it is by default).
2. Authentication → Emails → **Magic Link** template: add the code to the body, for example
   `<p>Your GemLedger sign-in code is <strong>{{ .Token }}</strong></p>`.
   Without `{{ .Token }}` the email only has a link, and the login page asks for a code.
3. The built-in mailer only sends a few emails an hour. Before the pilot, set up custom SMTP
   (Authentication → Emails → SMTP settings), for example with Resend, Brevo or Amazon SES.

### Without custom SMTP

Supabase locks the email templates until custom SMTP is set up, and the default
Magic Link email has a link but no code. The login page therefore sends a sign-in
link that lands on `/auth/callback`. Add `http://localhost:3000/**` (and the live
domain later) under Authentication → URL Configuration → Redirect URLs.
