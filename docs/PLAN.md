# Plan summary

The full, living plan is the [GemLedger — Product & Build Plan](https://claude.ai/artifact/3RhEWSWsgmeniUBQjAz93j).
This file records the decisions the code depends on.

## Decisions

| Date | Decision |
| --- | --- |
| 2026-11-05 | Launch in India, nationwide. Pilots in one or two cities first. UK is a later second market. |
| 2026-11-05 | Web first (Next.js), then one Expo app for Android and iPhone in Phase 2. |
| 2026-11-05 | TypeScript monorepo (pnpm + Turborepo) with shared domain types in `packages/shared`. |
| 2026-11-05 | Built by Joe with Claude; Joe handles deployment. |

## India-specific defaults

- Gold first: HUID hallmarks (6 alphanumeric characters) are a first-class field on every item.
- Login by phone OTP; claim links sent over WhatsApp and SMS.
- Billing via Razorpay / UPI. Prices stored in paise.
- Data hosted in India (Mumbai region) for the DPDP Act.
- Languages: English and Hindi first; regional languages added as shops sign up.

## Verification statuses

Shown side by side per piece of evidence, never as one "authentic" score:
`uploaded`, `jeweller_attested`, `lab_matched`, `mismatch`, `not_checkable`.

## Phases

0. Validate (weeks 1–4): 15 jeweller interviews, clickable prototype, lab API applications.
1. Web MVP (months 1–4): jeweller portal, QR passports, customer web wallet, verify page, GIA lookup, 5-shop pilot.
   Gate: 5 paying shops, 100 items, 60% claimed.
2. Native apps (months 4–7): Expo Android + iPhone, Apple/Google Wallet, repairs, transfers, OCR.
3. Scale (month 8+): jeweller native app, chains, more labs, second market.
