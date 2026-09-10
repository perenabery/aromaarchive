// REST API for the Архів Ароматів storefront — now multi-brand.
//
// Storage: a JSON file on disk (via lowdb) — swap the db.js adapter for
// Postgres/MySQL when you're ready to go beyond a prototype.
//
// Endpoints:
//   GET    /api/products          list all products
//   POST   /api/products          create a product
//   PUT    /api/products/:id      update a product
//   DELETE /api/products/:id      delete a product
//   GET    /api/brands            list brand directory (name + description)
//   POST   /api/brands            add a brand
//   PUT    /api/brands/:id        update a brand
//   DELETE /api/brands/:id        delete a brand
//   POST   /api/orders            place an order
//   GET    /api/orders            list orders (for a simple admin view)

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { nanoid } from "nanoid";
import { getDb } from "./db.js";

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" })); // generous limit: product photos are sent as base64
app.use(morgan("dev"));

const db = await getDb();

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
app.get("/api/products", (req, res) => {
  res.json(db.data.products);
});

app.post("/api/products", async (req, res) => {
  const { name, brand, category, family, type, notes, desc, topNotes, middleNotes, baseNotes, badge, image, variants } = req.body;
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
    variants: variants.map((v) => ({ id: v.id || nanoid(), volume: v.volume, price: Number(v.price), salePrice: v.salePrice ? Number(v.salePrice) : null })),
  };
  db.data.products.unshift(product);
  await db.write();
  res.status(201).json(product);
});

app.put("/api/products/:id", async (req, res) => {
  const idx = db.data.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  db.data.products[idx] = { ...db.data.products[idx], ...req.body, id: req.params.id };
  await db.write();
  res.json(db.data.products[idx]);
});

app.delete("/api/products/:id", async (req, res) => {
  const before = db.data.products.length;
  db.data.products = db.data.products.filter((p) => p.id !== req.params.id);
  if (db.data.products.length === before) return res.status(404).json({ error: "not found" });
  await db.write();
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Brands — a simple directory (name + description) that products reference
// by name. Powers a future "За брендами" page: group db.data.products by
// the `brand` field and show this description at the top of each group.
// ---------------------------------------------------------------------------
app.get("/api/brands", (req, res) => {
  res.json(db.data.brands);
});

app.post("/api/brands", async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const brand = { id: nanoid(), name, description: description || "" };
  db.data.brands.push(brand);
  await db.write();
  res.status(201).json(brand);
});

app.put("/api/brands/:id", async (req, res) => {
  const idx = db.data.brands.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "not found" });
  db.data.brands[idx] = { ...db.data.brands[idx], ...req.body, id: req.params.id };
  await db.write();
  res.json(db.data.brands[idx]);
});

app.delete("/api/brands/:id", async (req, res) => {
  const before = db.data.brands.length;
  db.data.brands = db.data.brands.filter((b) => b.id !== req.params.id);
  if (db.data.brands.length === before) return res.status(404).json({ error: "not found" });
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

app.get("/api/orders", (req, res) => {
  res.json(db.data.orders);
});

app.listen(PORT, () => {
  console.log(`Aroma Archive API running on http://localhost:${PORT}`);
});
