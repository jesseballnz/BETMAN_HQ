# ⚡ BETMAN HQ

> **The BETMAN Company Operating System.**  
> A live internal dashboard for the BETMAN founding team — replacing the spreadsheet.

---

## What it does

BETMAN HQ is the company scorecard, financial forecast, P&L, cash flow, salary tracker, and growth milestone board — all in one dark-mode mission-control interface.

**Core principle:** Active Weekly Subscribers (pulled live from Stripe) is the hero metric. Everything else — revenue, founder salaries, milestones, and P&L — is derived from it.

---

## Pages

| Route | Description |
|---|---|
| `/` | **Dashboard** — Hero metric, MRR/ARR, operating profit, cash position, salary tier, charts |
| `/scoreboard` | **Subscriber Scoreboard** — Monthly forecast, milestone progress bars |
| `/pnl` | **P&L** — Monthly and quarterly profit & loss |
| `/cashflow` | **Cash Flow** — Monthly cash flow statement with TENT funding |
| `/salary` | **Founder Salary Ladder** — Auto-calculated from live subscriber count |
| `/tent` | **TENT Treasury** — Separate from operating revenue |
| `/assumptions` | **Assumptions** — Editable page that drives all forecast calculations |
| `/kpi` | **KPI Dashboard** — Full KPI grid with live and forecast metrics |

---

## Running locally

### Prerequisites

- Node.js 18+
- A Stripe account (optional — the app runs with demo data without it)

### 1. Clone and install

```bash
git clone https://github.com/jesseballnz/BETMAN_HQ.git
cd BETMAN_HQ
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Stripe keys:

```env
STRIPE_SECRET_KEY=sk_live_...        # Required for live subscriber counts
STRIPE_WEEKLY_PRICE_ID=price_...     # Optional: explicit Price ID for weekly subs
STRIPE_DAY_PASS_PRICE_ID=price_...   # Optional: explicit Price ID for day passes
STRIPE_WEBHOOK_SECRET=whsec_...      # Required for real-time webhook updates
```

> **Without Stripe keys:** The app runs in demo mode using the numbers from the Assumptions page. The hero metric will show `0` for live subscribers and all calculations fall back to seeded assumptions.

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run tests

```bash
npm test
```

---

## Stripe setup

### How subscriber counts are pulled

BETMAN HQ fetches all **active** Stripe subscriptions at page load and classifies each by plan type:

| Plan type | Detection method (in priority order) |
|---|---|
| **Weekly** | 1. `STRIPE_WEEKLY_PRICE_ID` env var matches Price ID<br>2. `price.recurring.interval === 'week'`<br>3. `price.metadata.betman_plan = 'weekly'`<br>4. `product.metadata.betman_plan = 'weekly'`<br>5. Product name contains "weekly" |
| **Day Pass** | Same priority order, but for `day` / `day_pass` |

The simplest setup is to **set `STRIPE_WEEKLY_PRICE_ID`** to your weekly subscription Price ID. No metadata tagging required.

### Webhook (real-time updates)

Register a webhook in your Stripe dashboard pointing to:

```
https://your-domain.com/api/stripe/webhook
```

Select these events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`

This invalidates the server-side cache so the next page load fetches fresh counts immediately.

---

## Changing assumptions

Go to `/assumptions` in the running app. All fields are editable and immediately drive the 12-month forecast. Key assumptions:

| Assumption | Default | Where to change |
|---|---|---|
| Weekly pass price | NZ$9.95/week | Assumptions page → Pricing |
| Day pass price | NZ$7.95/day | Assumptions page → Pricing |
| Month 1–3 subscriber targets | 75 / 300 / 1,000 | Assumptions page → Subscriber Growth |
| Month 12 target | 10,000 | Assumptions page → Subscriber Growth |
| Hosting / AI / ElevenLabs baseline | NZ$2,000/month | Assumptions page → Expenses |

> **Note:** Assumptions are stored in memory. They reset on server restart. To persist across restarts, replace `src/data/store.ts` with a database-backed implementation.

---

## Architecture

```
src/
  app/                  Next.js App Router pages + API routes
    api/
      assumptions/      GET/POST/DELETE assumptions
      stripe/
        subscribers/    GET live subscriber counts from Stripe (cached 60s)
        webhook/        POST Stripe webhook handler (invalidates cache)
  components/           Shared UI components
  data/
    store.ts            In-memory assumptions store
    stripeCache.ts      TTL-based Stripe subscriber count cache
    liveCounts.ts       Unified live-vs-assumptions data fetcher
  lib/
    calculations.ts     All financial calculations (salary tier, P&L, cash flow)
    stripe.ts           Stripe client + plan classification logic
    types.ts            TypeScript interfaces
  __tests__/
    calculations.test.ts  67 tests covering all calculation logic
    stripe.test.ts        Stripe plan classification tests
```

---

## Tech stack

- **Next.js 14** (App Router, server components)
- **TypeScript**
- **Tailwind CSS** (dark BETMAN theme)
- **Recharts** (charts)
- **Stripe Node.js SDK** (live subscriber data)
- **Jest + ts-jest** (tests)

---

## Future integrations

The data layer is designed for easy extension:

| Integration | Where to add |
|---|---|
| Telegram member count | Add `TELEGRAM_BOT_TOKEN` + fetch in `liveCounts.ts` |
| BETMAN Radio listeners | Add analytics API call in `liveCounts.ts` |
| Betting treasury (TENT) | Replace demo data in `src/app/tent/page.tsx` |
| Persistent assumptions | Replace `src/data/store.ts` with Prisma/Postgres |
| Stripe Payment Intents (day passes) | Extend `fetchStripeSubscriberCounts` in `stripe.ts` |
