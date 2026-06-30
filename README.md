# LinkPay

LinkPay is a verified USDC payment-link app for people who want the simplicity of a payment request with the settlement speed of crypto.

Recipients create a payment link with an amount and memo. Payers open the link, see who requested the money, sign in with email, and pay with Arbitrum USDC. LinkPay tracks whether the request is unpaid, in progress, or paid, then stores the receipt and notifies the recipient.

## Why This Product

Stablecoin payments are useful, but most crypto payment experiences still expose wallet addresses, chain choices, gas concepts, and uncertain trust cues. That makes a simple request like “pay this invoice” feel technical.

LinkPay turns that into a familiar flow:

1. Create a request.
2. Share a link.
3. Payer reviews a verified request.
4. Payer submits USDC.
5. Recipient sees the paid status and receipt.

The core product idea is that account abstraction and embedded wallets should disappear into the background. The user should experience a payment link, not a crypto control panel.

## Target User

LinkPay is designed for small operators who request repeat payments:

- freelancers
- creators
- local service providers
- small online sellers
- communities collecting contributions
- crypto-native teams that still need a cleaner payer experience

These users do not need a full wallet dashboard. They need a request that is easy to create, easy to trust, and easy to reconcile after payment.

## Product Experience

### Recipient Flow

The recipient signs in with email, activates LinkPay once, and creates a request with:

- amount
- memo
- recipient wallet identity from the Magic wallet
- expiration window
- signed request payload

The app stores the signed request in Supabase and returns a short `/pay/:id` link.

### Payer Flow

The payer opens the link and sees:

- requested amount
- memo
- recipient label
- recipient wallet preview
- payment status
- available balance

Before payment, LinkPay claims the request in Supabase. That prevents another payer from paying the same open link at the same time.

### Receipt Flow

After the Particle Universal Account transaction is submitted, LinkPay stores:

- request id
- payer wallet/email
- transaction id
- transaction hash when available
- amount
- status
- timestamp

The recipient activity list updates from Supabase, not browser-local storage.

## System Architecture

LinkPay uses three layers:

### Wallet and Payment Layer

- Magic email OTP creates the embedded wallet.
- Magic EVM extension signs EIP-7702 authorization.
- Particle Universal Account creates and submits the USDC transfer.
- Arbitrum USDC is the settlement asset.

### Trust Layer

Each request is signed by the recipient wallet. The signed payload includes:

- amount
- memo
- recipient address
- recipient label
- chain id
- token address
- expiry
- nonce

The backend verifies the signature before storing the request. The payer screen verifies the stored payload again before showing the payment action.

### State Layer

Supabase stores durable state:

- `payment_requests`: request payload, signature, recipient, amount, status, expiry
- `payments`: submitted payment receipts and transaction references
- `notifications`: recipient notification attempts

Next.js API routes are the only Supabase writers. The browser does not receive the Supabase service role key.

## Backend Status Model

Payment requests move through these states:

- `open`: request is unpaid and payable
- `processing`: a payer has claimed the request
- `paid`: payment was submitted and recorded
- `expired`: request is no longer payable
- `cancelled`: request was manually closed

Payment records move through:

- `submitted`: transaction was submitted through Particle
- `confirmed`: reserved for on-chain confirmation
- `failed`: reserved for failed settlement tracking

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Magic SDK
- Particle Universal Account SDK
- ethers
- Supabase Postgres
- Supabase CLI migrations
- Optional Resend email notifications

## Environment Variables

```bash
# Magic
NEXT_PUBLIC_MAGIC_API_KEY=

# Particle Network
NEXT_PUBLIC_PROJECT_ID=
NEXT_PUBLIC_CLIENT_KEY=
NEXT_PUBLIC_APP_ID=

# Arbitrum
NEXT_PUBLIC_ARB_RPC_URL=https://arb1.arbitrum.io/rpc
NEXT_PUBLIC_BLOCKCHAIN_NETWORK=arbitrum

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Optional email notifications
RESEND_API_KEY=
NOTIFICATION_FROM_EMAIL=LinkPay <onboarding@resend.dev>
```

## Supabase Setup

Initialize Supabase locally:

```bash
supabase init
```

Apply migrations to a linked project:

```bash
supabase link --project-ref YOUR_PROJECT_REF --password YOUR_DB_PASSWORD
supabase db push --linked --password YOUR_DB_PASSWORD
```

Get API keys for the linked project:

```bash
supabase projects api-keys --project-ref YOUR_PROJECT_REF
```

Use the project URL as `NEXT_PUBLIC_SUPABASE_URL` and the service role key as `SUPABASE_SERVICE_ROLE_KEY`.

### Keep Supabase Active

The repository includes `.github/workflows/keep-supabase-active.yml`, which queries Supabase every three days and can also be run manually from GitHub Actions. Add these repository secrets after the Supabase migration has been applied:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The workflow reads from `payment_requests`, so it will fail until the LinkPay migration exists on the target Supabase project.

## Local Development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open:

```bash
http://localhost:3000
```

## Demo Walkthrough

1. Sign in with email.
2. Activate LinkPay once.
3. Create a USDC request with an amount and memo.
4. Copy the generated `/pay/:id` link.
5. Open the link in a clean session.
6. Review the verified payment request.
7. Pay with USDC.
8. Show the paid status and receipt.
9. Return to the recipient account and show the server-backed activity list.

## Verification Commands

```bash
pnpm lint
pnpm build
```

Supabase CLI migration file:

```bash
supabase/migrations/20260630141521_linkpay_backend_state.sql
```

## Product Direction

The next product step is a stronger merchant loop:

- customer-facing paid receipt page
- invoice numbering
- payment reminders
- recipient notification preferences
- on-chain confirmation worker
- CSV export for bookkeeping
- hosted public profile for repeat requesters

The wedge remains the same: make stablecoin payment requests feel like normal payment links, while keeping the crypto proof layer available when users need it.
