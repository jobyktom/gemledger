# Before the production launch

Things to do or decide before GemLedger goes live at **gemledger.vantalume.com**. Tick each one
off (change `[ ]` to `[x]`) as it's done. Most of these are settings in the Supabase or
Hostinger dashboards, not code.

## Remove test sign-ins

- [ ] **Delete the Supabase test phone numbers.** In Supabase, Authentication → Sign In /
  Providers → Phone → Test phone numbers, remove:
  - `919999900001=123456`: the test shop.
  - `919999900002`: the admin backup, linked to Joe's admin account. Make sure Joe can still
    sign in to the admin dashboard another way (real phone or email) before removing it.

  Anyone who knows a test number and its fixed code can sign in without an SMS, so these must
  not exist on the live site.
- [ ] **Turn off the pre-filled phone number on the login page.** In Hostinger, add the
  environment variable `NEXT_PUBLIC_LOGIN_PREFILL_PHONE=off`, then rebuild (it only takes effect
  after a new build). Afterwards, check the login page shows an empty phone box. (Added in PR #8.)
- [ ] **Decide what to do with the test shop "Claude Test Jewellers".** Delete it, or keep it
  but make sure it never appears to real customers. Also check for any test items or passports
  it issued; their QR links stay live while the passport exists.

## Sign-in emails and SMS

- [ ] **Set up your own email sender.** Supabase's built-in mailer only sends a few emails an
  hour, which real jewellers will hit. Set up custom SMTP with Resend (Authentication → Emails →
  SMTP settings), using a verified sending domain (for example `no-reply@vantalume.com`, with
  the DNS records Resend gives you).
- [ ] **Add the code to the sign-in email.** Once custom SMTP is on, Supabase lets you edit the
  Magic Link template. Add `{{ .Token }}` so the email contains a code, not only a link.
- [ ] **Consider typed 6-digit email codes.** Recommended but not built yet: people type the code
  from the email instead of tapping a link, which works better when the email is opened on a
  different device from the one signing in.
- [ ] **Set up a real SMS provider.** Phone sign-in needs a live provider (Twilio, MessageBird,
  Textlocal or Vonage). Indian SMS needs a DLT-registered sender ID and template.

## Addresses and redirects

- [ ] **Point Supabase at the production domain.** In Authentication → URL Configuration:
  - Site URL: `https://gemledger.vantalume.com`
  - Redirect URLs: include `https://gemledger.vantalume.com/**`, and remove
    `http://localhost:3000/**` and any other test or LAN addresses.
- [ ] **Set `NEXT_PUBLIC_SITE_URL=https://gemledger.vantalume.com` in Hostinger** and rebuild.
  QR codes use this address, so printed codes always point to the live site and never to a
  preview or local address. Do this before printing any real QR codes.

## Supabase plan and housekeeping

- [ ] **Move Supabase to a paid plan** (or accept the risk). The free plan pauses the project
  after a week without activity and has no daily backups.
- [ ] **Delete the keep-alive workflow** `.github/workflows/supabase-keepalive.yml` once on a
  paid plan. It only exists to stop the free project from pausing.
- [ ] **Check who is a platform admin.** Admins are added by hand to `platform_admins` and can
  read every shop's data. Make sure only the right people are in that table.
- [ ] **Run Supabase's security and performance advisors** (Database → Advisors) and fix
  anything flagged.

## Product and legal

- [ ] **Be clear about what "verified" means.** Lab checks (GIA, IGI, HRD) aren't connected yet,
  so every grading report is "uploaded", not "lab matched". Make sure the passport wording
  doesn't suggest a report was independently checked.
- [ ] **Publish a privacy policy and terms**, covering India's data-protection law (DPDP Act)
  since customer data is stored in Mumbai.
