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
//   POST   /api/admin/verify      check whether an admin key is correct       (public)
//   POST   /api/nova-poshta/cities       search cities by name                (public, proxies Nova Poshta)
//   POST   /api/nova-poshta/warehouses   list branches for a city              (public, proxies Nova Poshta)

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

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" })); // generous limit: product photos are sent as base64
app.use(morgan("dev"));

const db = await getDb();

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
    const npRes = await fetch(NOVA_POSHTA_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: NOVA_POSHTA_KEY, modelName: "Address", calledMethod: "getWarehouses",
        methodProperties: { CityRef: cityRef, Limit: "300" },
      }),
    });
    const data = await npRes.json();
    if (!data.success) return res.status(502).json({ error: "Nova Poshta rejected the request", details: data.errors });
    res.json(data.data.map((w) => ({ ref: w.Ref, description: w.Description, number: w.Number })));
  } catch (e) {
    res.status(502).json({ error: "Could not reach Nova Poshta" });
  }
});

app.listen(PORT, () => {
  console.log(`Aroma Archive API running on http://localhost:${PORT}`);
});
