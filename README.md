# GemLedger

Digital jewellery passports for India. Jewellers issue a QR-linked passport for each piece
(HUID hallmarks, lab reports, invoice, warranty, photos), and customers keep them in a free
wallet on their phone. Jewellers pay a monthly subscription.

**Status:** Phase 1 scaffold. Nothing here is production-ready yet.

Full plan: [GemLedger — Product & Build Plan](https://claude.ai/artifact/3RhEWSWsgmeniUBQjAz93j)
(summary in [`docs/PLAN.md`](docs/PLAN.md)).

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js app: jeweller portal, customer web wallet, public verify page |
| `apps/mobile` | Expo app for Android and iPhone (Phase 2, not created yet) |
| `packages/shared` | Domain types and validation (zod) shared by web, mobile and API |
| `docs` | Plan and decisions |

## Getting started

Requires Node 22+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev         # web app on http://localhost:3000
pnpm test        # unit tests
pnpm typecheck
pnpm build
```
