// REST API for the Архів Ароматів storefront — now multi-brand, with a
// simple shared admin key protecting anything that changes data.
//
// Storage: a JSON file on disk (via lowdb) — swap the db.js adapter for
// Postgres/MySQL when you're ready to go beyond a prototype.
//
// Endpoints:
//   GET    /api/products          list all products                    (public)
//   POST   /api/products          create a product                      (admin)
//   PUT    /api/products/:id      update a product                       (admin)
//   DELETE /api/products/:id      delete a product                        (admin)
//   GET    /api/brands            list brand directory                    (public)
//   POST   /api/brands            add a brand                              (admin)
//   PUT    /api/brands/:id        update a brand                            (admin)
//   DELETE /api/brands/:id        delete a brand                            (admin)
//   POST   /api/orders            place an order                            (public — customers checking out)
//   GET    /api/orders            list orders                                (admin)
//   PUT    /api/orders/:id        update an order's status                    (admin)
//   POST   /api/admin/verify      check whether an admin key is correct       (public)
//   GET    /api/admin/telegram-chat-id   find your chat id after messaging the bot  (admin)
//   POST   /api/nova-poshta/cities       search cities by name                (public, proxies Nova Poshta)
//   POST   /api/nova-poshta/warehouses   list branches for a city              (public, proxies Nova Poshta)
//   GET    /api/settings          hero image/video + crop (shared, not per-browser)  (public)
//   PUT    /api/settings          update those settings                        (admin)

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { nanoid } from "nanoid";
import { getDb } from "./db.js";

const PORT = process.env.PORT || 4000;
// Set this in Render → your service → Environment → add ADMIN_KEY with your
// own secret value. Falling back to a default so the server still runs if
// you haven't set one yet — but change it before sharing the admin panel
// with anyone, since the fallback is public (it's sitting right here in the
// code on GitHub).
const ADMIN_KEY = process.env.ADMIN_KEY || "change-me-please";
// Get a free key from new.novaposhta.ua → Особистий кабінет → Налаштування →
// API ключі (no business verification needed, just a phone-verified account).
// Set it in Render → your service → Environment → NOVA_POSHTA_KEY. Until you
// do, the two /api/nova-poshta/* routes below just return a clear error
// instead of crashing, so the rest of the site keeps working.
const NOVA_POSHTA_KEY = process.env.NOVA_POSHTA_KEY || "";
const NOVA_POSHTA_URL = "https://api.novaposhta.ua/v2.0/json/";
// Telegram order notifications — see README for the two-minute setup
// (create a bot with @BotFather, message it once, then use
// GET /api/admin/telegram-chat-id to find your chat id). Until both are
// set, orders just save normally with no notification — nothing breaks.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" })); // generous limit: product photos are sent as base64
app.use(morgan("dev"));

const db = await getDb();

// Fire-and-forget — never awaited by the order route, so a slow or failing
// Telegram call never delays the customer's checkout or breaks the order.
async function notifyTelegram(order) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const itemsText = order.items.map((i) => `• ${i.qty} × ${i.name} (${i.volume}) — ${i.price} ₴`).join("\n");
  const c = order.customer;
  const paymentLabel = c?.paymentMethod === "cod" ? "Накладений платіж" : c?.paymentMethod || "Не вказано";
  const customerText = c
    ? `${c.name || "—"}\n${c.phone || "—"}${c.city ? `\n${c.city}${c.warehouse ? " — " + c.warehouse : ""}` : ""}\n💳 ${paymentLabel}`
    : "Без даних клієнта";
  const text = `🛍 Нове замовлення на ${order.total} ₴\n\n${itemsText}\n\n👤 ${customerText}`;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
  } catch (e) { console.error("Telegram notify failed:", e.message); }
}

function requireAdmin(req, res, next) {
  const key = req.header("x-admin-key");
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "invalid or missing admin key" });
  next();
}

app.post("/api/admin/verify", (req, res) => {
  const { key } = req.body;
  if (key === ADMIN_KEY) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

// After creating a bot with @BotFather and messaging it once, call this
// (with your admin key) to find the chat id to put in TELEGRAM_CHAT_ID —
// saves you from reading raw Telegram API JSON by hand.
app.get("/api/admin/telegram-chat-id", requireAdmin, async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN) return res.status(503).json({ error: "TELEGRAM_BOT_TOKEN is not set yet" });
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`);
    const data = await r.json();
    const last = data.result?.[data.result.length - 1];
    const chatId = last?.message?.chat?.id ?? null;
    res.json({ chatId, messagesSeen: data.result?.length || 0 });
  } catch (e) { res.status(502).json({ error: "Could not reach Telegram" }); }
});

// Debug helper: shows the raw first few warehouse records straight from
// Nova Poshta for a city, so you (or I) can double-check field names/values
// if something like the branch/postomat split ever looks wrong again —
// open with ?city=Київ in the browser after logging into the admin panel
// (it needs the x-admin-key header, so use a REST client or ask me to check
// it with you rather than pasting the URL directly into the address bar).
app.get("/api/admin/np-debug", requireAdmin, async (req, res) => {
  if (!NOVA_POSHTA_KEY) return res.status(503).json({ error: "NOVA_POSHTA_KEY is not set yet" });
  const cityName = req.query.city || "Київ";
  try {
    const cityRes = await fetch(NOVA_POSHTA_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: NOVA_POSHTA_KEY, modelName: "Address", calledMethod: "getCities", methodProperties: { FindByString: cityName, Limit: "1" } }),
    });
    const cityData = await cityRes.json();
    const cityRef = cityData.data?.[0]?.Ref;
    if (!cityRef) return res.json({ error: "city not found", cityName });

    const PAGE_SIZE = 300;
    let page = 1, allWh = [], pagesFetched = 0;
    while (page <= 15) {
      const whRes = await fetch(NOVA_POSHTA_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: NOVA_POSHTA_KEY, modelName: "Address", calledMethod: "getWarehouses", methodProperties: { CityRef: cityRef, Limit: String(PAGE_SIZE), Page: String(page) } }),
      });
      const whData = await whRes.json();
      pagesFetched++;
      allWh = allWh.concat(whData.data || []);
      if ((whData.data || []).length < PAGE_SIZE) break;
      page++;
    }
    const total = allWh.length;
    const sample = allWh.slice(0, 3).map((w) => ({
      Description: w.Description, CategoryOfWarehouse: w.CategoryOfWarehouse, TypeOfWarehouse: w.TypeOfWarehouse,
    }));
    const categoryCounts = {};
    allWh.forEach((w) => { categoryCounts[w.CategoryOfWarehouse || "undefined"] = (categoryCounts[w.CategoryOfWarehouse || "undefined"] || 0) + 1; });
    res.json({ cityName, total, pagesFetched, categoryCounts, sample });
  } catch (e) { res.status(502).json({ error: "Could not reach Nova Poshta" }); }
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
app.get("/api/products", (req, res) => {
  res.json(db.data.products);
});

app.post("/api/products", requireAdmin, async (req, res) => {
  const { name, brand, category, family, type, notes, desc, topNotes, middleNotes, baseNotes, badge, image, imageZoom, imagePosX, imagePosY, variants } = req.body;
  if (!name || !Array.isArray(variants) || variants.length === 0) {
    return res.status(400).json({ error: "name and at least one variant are required" });
  }
  const nextCode = db.data.products.length
    ? Math.max(...db.data.products.map((p) => p.code)) + 1
    : 1;
  const product = {
    id: nanoid(),
    code: nextCode,
    name,
    brand: brand || null,
    category: category || "unisex",
    family: family || "деревні",
    type: type || "Парфумована вода",
    notes: notes || "",
    desc: desc || "",
    topNotes: topNotes || "",
    middleNotes: middleNotes || "",
    baseNotes: baseNotes || "",
    badge: badge || null,
    image: image || null,
    imageZoom: imageZoom ?? 100,
    imagePosX: imagePosX ?? 50,
    imagePosY: imagePosY ?? 50,
    variants: variants.map((v) => ({ id: v.id || nanoid(), volume: v.volume, price: Number(v.price), salePrice: v.salePrice ? Number(v.salePrice) : null })),
  };
  db.data.products.unshift(product);
  await db.write();
  res.status(201).json(product);
});

app.put("/api/products/:id", requireAdmin, async (req, res) => {
  const idx = db.data.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  db.data.products[idx] = { ...db.data.products[idx], ...req.body, id: req.params.id };
  await db.write();
  res.json(db.data.products[idx]);
});

app.delete("/api/products/:id", requireAdmin, async (req, res) => {
  const before = db.data.products.length;
  db.data.products = db.data.products.filter((p) => p.id !== req.params.id);
  if (db.data.products.length === before) return res.status(404).json({ error: "not found" });
  await db.write();
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Brands — a simple directory (name + description) that products reference
// by name. Powers the "За брендами" page: group db.data.products by the
// `brand` field and show this description at the top of each group.
// ---------------------------------------------------------------------------
app.get("/api/brands", (req, res) => {
  res.json(db.data.brands);
});

app.post("/api/brands", requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const brand = { id: nanoid(), name, description: description || "" };
  db.data.brands.push(brand);
  await db.write();
  res.status(201).json(brand);
});

app.put("/api/brands/:id", requireAdmin, async (req, res) => {
  const idx = db.data.brands.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  db.data.brands[idx] = { ...db.data.brands[idx], ...req.body, id: req.params.id };
  await db.write();
  res.json(db.data.brands[idx]);
});

app.delete("/api/brands/:id", requireAdmin, async (req, res) => {
  const before = db.data.brands.length;
  db.data.brands = db.data.brands.filter((b) => b.id !== req.params.id);
  if (db.data.brands.length === before) return res.status(404).json({ error: "not found" });
  await db.write();
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Reviews — attached to a product by id. Public can read + submit; only the
// admin can delete/moderate.
// ---------------------------------------------------------------------------
app.get("/api/reviews", (req, res) => {
  const { productId } = req.query;
  const all = db.data.reviews || [];
  res.json(productId ? all.filter((r) => r.productId === productId) : all);
});

app.post("/api/reviews", async (req, res) => {
  const { productId, author, rating, text } = req.body;
  if (!productId || !author || !rating) {
    return res.status(400).json({ error: "productId, author and rating are required" });
  }
  const review = {
    id: nanoid(), productId, author, rating: Math.max(1, Math.min(5, Number(rating))),
    text: text || "", createdAt: new Date().toISOString(), approved: true,
  };
  db.data.reviews = db.data.reviews || [];
  db.data.reviews.unshift(review);
  await db.write();
  res.status(201).json(review);
});

app.delete("/api/reviews/:id", requireAdmin, async (req, res) => {
  db.data.reviews = (db.data.reviews || []).filter((r) => r.id !== req.params.id);
  await db.write();
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Collections ("Підбірки") — a named, hand-picked list of product ids.
// ---------------------------------------------------------------------------
app.get("/api/collections", (req, res) => {
  res.json(db.data.collections || []);
});

// ---------------------------------------------------------------------------
// Site settings — hero image/video + crop, shared by everyone who loads the
// site (unlike browser-local storage, this is the same for every device).
// ---------------------------------------------------------------------------
app.get("/api/settings", (req, res) => {
  res.json(db.data.settings);
});

app.put("/api/settings", requireAdmin, async (req, res) => {
  db.data.settings = { ...db.data.settings, ...req.body };
  await db.write();
  res.json(db.data.settings);
});

app.post("/api/collections", requireAdmin, async (req, res) => {
  const { name, description, productIds } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const collection = { id: nanoid(), name, description: description || "", productIds: productIds || [] };
  db.data.collections = db.data.collections || [];
  db.data.collections.push(collection);
  await db.write();
  res.status(201).json(collection);
});

app.put("/api/collections/:id", requireAdmin, async (req, res) => {
  const list = db.data.collections || [];
  const idx = list.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  list[idx] = { ...list[idx], ...req.body, id: req.params.id };
  await db.write();
  res.json(list[idx]);
});

app.delete("/api/collections/:id", requireAdmin, async (req, res) => {
  db.data.collections = (db.data.collections || []).filter((c) => c.id !== req.params.id);
  await db.write();
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
app.post("/api/orders", async (req, res) => {
  const { items, customer } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items are required" });
  }
  const order = {
    id: nanoid(),
    createdAt: new Date().toISOString(),
    status: "new", // new -> paid -> shipped -> done  (wire this up to real payment/shipping webhooks)
    items,
    customer: customer || null,
    total: items.reduce((sum, i) => sum + i.price * i.qty, 0),
  };
  db.data.orders.unshift(order);
  await db.write();
  notifyTelegram(order); // fire-and-forget — see the function above

  // --- where real integrations go -----------------------------------------
  // Payment (e.g. LiqPay/Fondy for UAH, or Stripe):
  //   create a payment/checkout session here and return its redirect URL
  //   instead of just saving the order as "new".
  // Shipping (e.g. Nova Poshta API):
  //   look up branches/rates using their API once you collect the address.
  // Both require your own merchant account and API keys — see README.

  res.status(201).json(order);
});

app.get("/api/orders", requireAdmin, (req, res) => {
  res.json(db.data.orders);
});

app.put("/api/orders/:id", requireAdmin, async (req, res) => {
  const { status } = req.body;
  const idx = db.data.orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  db.data.orders[idx].status = status;
  await db.write();
  res.json(db.data.orders[idx]);
});

// ---------------------------------------------------------------------------
// Nova Poshta — city + branch lookup for the checkout form. This is a thin
// proxy: the frontend never sees NOVA_POSHTA_KEY, it just calls these two
// routes. Nova Poshta's own API is a single endpoint with a `calledMethod`
// field rather than separate REST routes — that's their design, not a
// simplification on our side.
// ---------------------------------------------------------------------------
app.post("/api/nova-poshta/cities", async (req, res) => {
  if (!NOVA_POSHTA_KEY) return res.status(503).json({ error: "Nova Poshta API key is not configured on the server yet" });
  const { query } = req.body;
  if (!query || query.trim().length < 2) return res.json([]);
  try {
    const npRes = await fetch(NOVA_POSHTA_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: NOVA_POSHTA_KEY, modelName: "Address", calledMethod: "getCities",
        methodProperties: { FindByString: query.trim(), Limit: "15" },
      }),
    });
    const data = await npRes.json();
    if (!data.success) return res.status(502).json({ error: "Nova Poshta rejected the request", details: data.errors });
    res.json(data.data.map((c) => ({ ref: c.Ref, name: c.Description, area: c.AreaDescription })));
  } catch (e) {
    res.status(502).json({ error: "Could not reach Nova Poshta" });
  }
});

app.post("/api/nova-poshta/warehouses", async (req, res) => {
  if (!NOVA_POSHTA_KEY) return res.status(503).json({ error: "Nova Poshta API key is not configured on the server yet" });
  const { cityRef } = req.body;
  if (!cityRef) return res.status(400).json({ error: "cityRef is required" });
  try {
    // Nova Poshta caps how many warehouses it returns per request (observed:
    // it silently returns ~300 regardless of the Limit we ask for) — so for
    // a big city we page through results with the Page parameter. Kept to a
    // handful of pages (not more) so a big city can't make this hang.
    const PAGE_SIZE = 300;
    const MAX_PAGES = 12; // 12 × 300 = 3600 — Kyiv alone has ~2400 branches+postomats combined
    let page = 1;
    let all = [];
    while (page <= MAX_PAGES) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let data;
      try {
        const npRes = await fetch(NOVA_POSHTA_URL, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({
            apiKey: NOVA_POSHTA_KEY, modelName: "Address", calledMethod: "getWarehouses",
            methodProperties: { CityRef: cityRef, Limit: String(PAGE_SIZE), Page: String(page) },
          }),
        });
        data = await npRes.json();
      } finally { clearTimeout(timeout); }
      if (!data.success) {
        // If paging itself isn't accepted, fall back to whatever page 1 gave
        // us rather than failing the whole request.
        if (page === 1) return res.status(502).json({ error: "Nova Poshta rejected the request", details: data.errors });
        break;
      }
      all = all.concat(data.data);
      if (data.data.length < PAGE_SIZE) break; // last page
      page++;
    }
    res.json(all.map((w) => ({
      ref: w.Ref, description: w.Description, number: w.Number,
      // Nova Poshta's API marks each point with CategoryOfWarehouse ("Postomat"
      // vs everything else = a staffed branch). Older/edge responses sometimes
      // omit that field, so we fall back to checking the description text.
      category: w.CategoryOfWarehouse === "Postomat" || /поштомат/i.test(w.Description || "") ? "postomat" : "branch",
    })));
  } catch (e) {
    res.status(502).json({ error: "Could not reach Nova Poshta" });
  }
});

app.listen(PORT, () => {
  console.log(`Aroma Archive API running on http://localhost:${PORT}`);
});
