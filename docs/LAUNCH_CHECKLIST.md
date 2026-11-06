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

## Apple Wallet and Google Wallet passes

The "Add to Apple Wallet" and "Add to Google Wallet" buttons on passport pages stay hidden until
these steps are done. Each wallet switches on by itself once its settings are in Hostinger.

- [ ] **Apply the wallet database change.** Run `supabase/migrations/20261106150000_wallet_passes.sql`
  on the live Supabase project (Claude can do this). Apple Wallet won't work without it.

**Apple Wallet** (US$99 a year)

- [ ] **Join the Apple Developer Program** at developer.apple.com/programs. Enrolling as a
  company shows the business name, not your own, and needs a free D-U-N-S number (allow one to
  two weeks for it).
- [ ] **Create a Pass Type ID.** In Certificates, Identifiers & Profiles → Identifiers → "+" →
  Pass Type IDs, enter a description ("GemLedger passport") and an identifier such as
  `pass.com.vantalume.gemledger`.
- [ ] **Create its certificate.** Open the Pass Type ID → Create Certificate. Apple asks for a
  certificate signing request (CSR); on Windows, ask Claude to make one with you. Download the
  `.cer`, then turn it into a `.p12` file with a password (Claude can help with this step too).
- [ ] **Download Apple's WWDR G4 certificate** (`AppleWWDRCAG4.cer`) from
  apple.com/certificateauthority.
- [ ] **Add the Apple settings in Hostinger**, then redeploy:
  - `APPLE_WALLET_CERT_P12`: the `.p12` file as base64 text
  - `APPLE_WALLET_CERT_PASSWORD`: its password
  - `APPLE_WALLET_WWDR_CERT`: the WWDR `.cer` file as base64 text
- [ ] **Diary a yearly renewal.** The Pass Type ID certificate expires after about a year. When
  it expires, the Apple button disappears until a new `.p12` is added. Passes already on phones
  keep working, but stop updating.

**Google Wallet** (free)

- [ ] **Create a Google Wallet issuer account** in the Google Pay & Wallet Console
  (pay.google.com/business/console) → Google Wallet API. Note the **Issuer ID**.
- [ ] **Create a service account.** In Google Cloud Console, create a project, enable the
  "Google Wallet API", then IAM → Service accounts → create one and add a JSON key. Download
  the key file and keep it private.
- [ ] **Give the service account access.** In the Wallet console → Users, invite the service
  account's email address as a Developer.
- [ ] **Add the Google settings in Hostinger**, then redeploy:
  - `GOOGLE_WALLET_ISSUER_ID`: the Issuer ID
  - `GOOGLE_WALLET_SERVICE_ACCOUNT`: the whole JSON key file (or the file as base64 text)
- [ ] **Test, then ask Google to publish.** Until Google approves the issuer account, only
  test accounts added in the console can save cards. Once a test card looks right, request
  publishing access in the console.

**Both**

- [ ] **Swap in the official badges.** Apple and Google require their own "Add to Apple Wallet"
  and "Add to Google Wallet" badge artwork. Download them from Apple's Wallet marketing
  guidelines and Google's brand guidelines and replace the placeholder buttons
  (`apps/web/src/app/p/[id]/wallet-buttons.tsx`).
- [ ] **Try it on real phones**: add a passport on an iPhone and an Android phone, then check
  the card shows the right item, QR code and shop, and opens the live passport when tapped.

## Product and legal

- [ ] **Be clear about what "verified" means.** Lab checks (GIA, IGI, HRD) aren't connected yet,
  so every grading report is "uploaded", not "lab matched". Make sure the passport wording
  doesn't suggest a report was independently checked.
- [ ] **Publish a privacy policy and terms**, covering India's data-protection law (DPDP Act)
  since customer data is stored in Mumbai.
