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

`20261106140000_staff_management.sql` adds staff management:

- `shop_members.status` (`active`, `suspended`, `removed`) and `display_name`. Rows are never
  deleted, so work done by someone who left still points at a named record. Membership checks
  now require an active member of a shop that isn't suspended.
- `shop_invites`: a shop admin invites a person by exact mobile number or email. It is accepted
  only by a user who has verified that number or email in Supabase Auth, and expires in 7 days.
  Invites that grant the shop admin role (`owner`) are never auto-accepted.
- `staff_activity_log`: every staff change. Append-only, even for the database owner.
- Functions `staff_invite`, `staff_rename`, `staff_change_role`, `staff_offer_admin`,
  `staff_set_status`, `staff_change_login`, `staff_cancel_invite`, `staff_list`,
  `accept_staff_invites`, `accept_staff_invite`, `my_pending_invites`, and for GemLedger admins
  `admin_invite_shop_admin` (recovery) and `admin_set_member_status`. The old "owners manage
  staff" policy is gone; these functions are the only way to change staff.
- Sensitive actions (adding or removing a shop admin, changing someone's sign-in, recovery)
  need a sign-in code entered in the last 10 minutes, read from the token's `amr` claim.

Row-level security is on for every table: a user only sees rows for shops they belong to.
Shops can record lab reports as `uploaded` but cannot mark them `lab_matched`; only the
server-side lab connector can.

## Tests

`tests/rls_test.sql` checks tenant isolation, shop approval, self-verification and the public
verify function. `tests/staff_test.sql` checks staff management, including the abuse cases
(staff promoting themselves, one shop touching another's staff, removing the last admin,
expired or unverified invites, editing the activity log). It runs inside a transaction and rolls back. Run it against a local or branch
database (never production):

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_test.sql
psql "$DATABASE_URL" -f supabase/tests/staff_test.sql
psql "$DATABASE_URL" -f supabase/tests/wallet_test.sql
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

`20261106150000_wallet_passes.sql` adds Apple Wallet and Google Wallet support:

- `private.wallet_tokens`: each pass's Apple authentication token, made on first use.
- `private.wallet_apple_registrations`: which iPhones (Apple's anonymous device and push IDs)
  hold which pass, so they can be told when it changes. No customer details.
- `wallet_pass_meta`, `wallet_apple_register`, `wallet_apple_unregister` and
  `wallet_apple_device_passes` back Apple's web service and are callable without signing in;
  knowing a passport's public ID already lets anyone download its pass, so that is the boundary.
  `wallet_apple_push_tokens` is only for the issuing shop's staff and GemLedger admins.
- `tests/wallet_test.sql` checks all of this.
