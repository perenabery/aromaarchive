# Aroma Archive — backend prototype

A minimal Express API that stores products, brands, and orders in a local
JSON file (`db.json`, created automatically on first run). Multi-brand: each
product has a `brand` field, and there's a small brand directory to power a
future "За брендами" page.

## Run it locally

```bash
cd backend
npm install
npm start
```

The API starts at `http://localhost:4000`. Try it:

```bash
curl http://localhost:4000/api/products
curl http://localhost:4000/api/brands
```

## Endpoints

| Method | Path                | What it does              |
|--------|---------------------|----------------------------|
| GET    | /api/products       | list all products           |
| POST   | /api/products       | create a product             |
| PUT    | /api/products/:id   | update a product              |
| DELETE | /api/products/:id   | delete a product               |
| GET    | /api/brands         | list the brand directory        |
| POST   | /api/brands         | add a brand                      |
| PUT    | /api/brands/:id     | update a brand                    |
| DELETE | /api/brands/:id     | delete a brand                     |
| POST   | /api/orders         | place an order                      |
| GET    | /api/orders          | list orders                          |

## What I actually verified vs. what I didn't

Being precise about this because it matters for a backend:

- **Verified:** both `server.js` and `db.js` are syntactically valid
  JavaScript (checked with esbuild) — no typos, no broken imports, correct
  ES module syntax.
- **Not verified:** I could not run `npm install` or actually start this
  server and hit it with real requests. My sandbox has no network access, so
  I can't reach the npm registry or bind a live port the way I stress-tested
  the frontend (which I *did* run in a real browser repeatedly). You're the
  first one to actually run this code — if `npm start` throws anything,
  paste me the error and I'll fix it immediately.

## Connecting the storefront to this API

The React storefront (`aroma-archive.jsx` / `aroma-archive-standalone.html`)
currently saves everything to the browser's own local storage, so it runs
standalone with no server. To wire it to this API instead:

1. Deploy this backend somewhere reachable (Render, Railway, Fly.io, a VPS —
   anywhere that runs Node).
2. In the storefront, replace the `window.storage.get/set` calls with
   `fetch('https://your-api-url/api/products')` calls (`GET` on load,
   `POST`/`PUT`/`DELETE` from the admin panel), and point the "Оформити
   замовлення" button at `POST /api/orders` instead of the current fake
   confirmation.
3. Add a loading/error state around those calls, since a network request can
   fail in ways local storage can't.

I held off doing this wiring in the same pass as this backend rewrite,
because I can't test the live request/response cycle from here — I'd rather
hand you working, syntax-checked code and do the actual fetch integration as
its own verifiable step once this server is running somewhere real (even
just your own machine on `localhost:4000` — tell me once it's up and I'll
switch the frontend over and we can test it together).

## What's *not* included, and why

This prototype stops short of a few things that need real-world accounts and
credentials I can't create for you:

- **Payment.** For Ukraine, the common choices are LiqPay or Fondy (or Stripe
  if you need international cards). You'd register a merchant account, get
  API keys, and create a checkout session inside `POST /api/orders` — the
  code has a comment marking exactly where that goes.
- **A production database.** `db.json` is fine for a prototype but isn't safe
  for concurrent writes at real traffic. Swap `db.js` for a Postgres/MySQL
  client (e.g. Prisma) when you're ready — the route handlers above it
  wouldn't need to change much.

## Nova Poshta delivery (already wired up, just needs your key)

Unlike payment, this *is* connected end-to-end — the checkout form searches
cities and lists branches for real. You just need to supply your own key:

1. Go to **new.novaposhta.ua** → sign in (or create an account — just needs
   a phone number, no business verification).
2. Open **Особистий кабінет → Налаштування → API ключі** and generate a key.
3. On Render: your service → **Environment** → add a variable named
   `NOVA_POSHTA_KEY` with that value → save (Render redeploys automatically).

Until that variable is set, `/api/nova-poshta/cities` and `/api/nova-poshta/warehouses`
return a clear "not configured yet" error instead of crashing, so the rest of
checkout still works — the city/branch fields just won't return results.

## Telegram order notifications (optional, two-minute setup)

When both variables below are set, you get a Telegram message the instant
someone places an order — item, total, name, phone, city, branch. If either
is missing, orders just save normally with no message — nothing breaks.

1. In Telegram, message **@BotFather** → send `/newbot` → follow the
   prompts (pick any name and username) → it gives you a **token** that
   looks like `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
2. Find your new bot in Telegram (search the username you gave it) and send
   it any message, e.g. "Привіт" — this is required once, so Telegram knows
   where to deliver messages later.
3. On Render: **Environment** → add `TELEGRAM_BOT_TOKEN` with that token →
   save (redeploys automatically).
4. Once redeployed, open the admin panel on the site (⚙ → log in), stay on
   the **Товари** tab, and find **"Знайти Telegram chat ID"** near the top —
   click it, then **"Перевірити"**. It shows your chat id right there (no
   need to open any URL by hand or add custom headers).
5. Back on Render: add a second variable, `TELEGRAM_CHAT_ID`, with that
   number → save.

From then on, every new order sends you a Telegram message automatically.
