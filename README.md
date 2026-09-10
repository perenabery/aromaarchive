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
- **Delivery / Nova Poshta.** Their API needs its own API key from a business
  account; you'd use it to look up branches and calculate shipping cost once
  you have the customer's address.
- **A production database.** `db.json` is fine for a prototype but isn't safe
  for concurrent writes at real traffic. Swap `db.js` for a Postgres/MySQL
  client (e.g. Prisma) when you're ready — the route handlers above it
  wouldn't need to change much.
- **Auth on the admin routes.** Right now anyone with the URL can POST/PUT/
  DELETE products or brands. Add an auth check (a simple shared admin token
  is enough to start) before deploying this anywhere public.
