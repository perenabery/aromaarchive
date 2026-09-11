import { JSONFilePreset } from "lowdb/node";

// Product shape mirrors the frontend (aroma-archive.jsx) exactly, plus a
// "brand" field now that the store is multi-brand.
const SEED_PRODUCTS = [
  { id: "p1", code: 1, name: "Тиха Кімната", brand: "Maison Cendre", category: "unisex", family: "деревні", badge: "bestseller", image: null, type: "Парфумована вода",
    notes: "Кедр, вологий папір, мускус", desc: "Запах бібліотеки після дощу — тепле дерево і тиша.",
    topNotes: "Бергамот, рожевий перець", middleNotes: "Вологий папір, іріс", baseNotes: "Кедр, мускус, амбра",
    variants: [{ id: "v1", volume: "5 мл", price: 1450, salePrice: null }, { id: "v2", volume: "10 мл", price: 2100, salePrice: null }, { id: "v3", volume: "30 мл", price: 2400, salePrice: null }, { id: "v4", volume: "50 мл", price: 3400, salePrice: null }] },
  { id: "p2", code: 2, name: "Дощ у Порту", brand: "Sel Noir", category: "men", family: "свіжі", badge: "sale", image: null, type: "Парфумована вода",
    notes: "Сіль, амбра, чорний перець", desc: "Холодне повітря з боку моря і мокрий асфальт.",
    topNotes: "Морська сіль, грейпфрут", middleNotes: "Чорний перець, лаванда", baseNotes: "Амбра, ветивер",
    variants: [{ id: "v1", volume: "5 мл", price: 1050, salePrice: 890 }, { id: "v2", volume: "30 мл", price: 2100, salePrice: 1690 }, { id: "v3", volume: "50 мл", price: 2990, salePrice: 2390 }] },
  { id: "p3", code: 3, name: "Бурштиновий Вечір", brand: "Atelier Nomade", category: "women", family: "солодкі", badge: "new", image: null, type: "Парфумована вода",
    notes: "Бурштин, ваніль, кориця", desc: "Свічка, що догорає у кімнаті без інших звуків.",
    topNotes: "Кориця, мандарин", middleNotes: "Ваніль, бензоїн", baseNotes: "Бурштин, тонка амбра",
    variants: [{ id: "v1", volume: "30 мл", price: 2650, salePrice: null }, { id: "v2", volume: "50 мл", price: 3750, salePrice: null }] },
  { id: "p4", code: 4, name: "Сіль і Полин", brand: "Sel Noir", category: "unisex", family: "деревні", badge: null, image: null, type: "Парфумована вода",
    notes: "Полин, морська сіль, ветивер", desc: "Гіркота трав, яку приносить вітер з узбережжя.",
    topNotes: "Морська сіль, бергамот", middleNotes: "Полин, шавлія", baseNotes: "Ветивер, кедр",
    variants: [{ id: "v1", volume: "30 мл", price: 2200, salePrice: null }, { id: "v2", volume: "50 мл", price: 3100, salePrice: null }] },
  { id: "p5", code: 5, name: "Нічний Архів", brand: "Maison Cendre", category: "men", family: "шкіряні", badge: "bestseller", image: null, type: "Парфумована вода інтенс",
    notes: "Шкіра, тютюн, кедр", desc: "Стара шкіряна течка, залишена на столі до ранку.",
    topNotes: "Тютюновий лист, кардамон", middleNotes: "Шкіра, троянда", baseNotes: "Кедр, ветивер",
    variants: [{ id: "v1", volume: "10 мл", price: 2200, salePrice: null }, { id: "v2", volume: "50 мл", price: 3890, salePrice: null }, { id: "v3", volume: "100 мл", price: 5600, salePrice: null }] },
  { id: "p6", code: 6, name: "Паперовий Слід", brand: "Verte & Fils", category: "women", family: "квіткові", badge: "sale", image: null, type: "Парфумована вода",
    notes: "Ірис, біла амбра, мускус", desc: "Сторінка, яку перегортали тисячу разів.",
    topNotes: "Альдегіди, бергамот", middleNotes: "Іріс, фіалка", baseNotes: "Біла амбра, мускус",
    variants: [{ id: "v1", volume: "30 мл", price: 2500, salePrice: 2020 }, { id: "v2", volume: "50 мл", price: 3560, salePrice: 2890 }] },
  { id: "p7", code: 7, name: "Ранкова Пошта", brand: "Atelier Nomade", category: "unisex", family: "цитрусові", badge: "new", image: null, type: "Туалетна вода",
    notes: "Бергамот, чай, кедр", desc: "Перша філіжанка і стос конвертів на порозі.",
    topNotes: "Бергамот, лимон", middleNotes: "Чай, кардамон", baseNotes: "Кедр, білий мускус",
    variants: [{ id: "v1", volume: "30 мл", price: 1990, salePrice: null }, { id: "v2", volume: "50 мл", price: 2790, salePrice: null }] },
  { id: "p8", code: 8, name: "Цитрусовий Лист", brand: "Verte & Fils", category: "women", family: "цитрусові", badge: null, image: null, type: "Туалетна вода",
    notes: "Грейпфрут, зелений чай, мускус", desc: "Легкість вранці, коли вікно ще прочинене.",
    topNotes: "Грейпфрут, мандарин", middleNotes: "Зелений чай, жасмин", baseNotes: "Мускус, кедр",
    variants: [{ id: "v1", volume: "30 мл", price: 1890, salePrice: null }, { id: "v2", volume: "50 мл", price: 2650, salePrice: null }] },
  { id: "p9", code: 9, name: "Шкіряна Обкладинка", brand: "Maison Cendre", category: "men", family: "шкіряні", badge: null, image: null, type: "Парфумована вода",
    notes: "Шкіра, ветивер, чорний чай", desc: "Обкладинка книги, яку носили в кишені роками.",
    topNotes: "Чорний перець, бергамот", middleNotes: "Шкіра, тютюн", baseNotes: "Ветивер, чорний чай",
    variants: [{ id: "v1", volume: "50 мл", price: 3320, salePrice: null }, { id: "v2", volume: "100 мл", price: 4700, salePrice: null }] },
  { id: "p10", code: 10, name: "Кедр і Дим", brand: "Sel Noir", category: "men", family: "деревні", badge: "sale", image: null, type: "Парфумована вода",
    notes: "Кедр, дим, ладан", desc: "Багаття, що вже майже згасло, але ще тримає тепло.",
    topNotes: "Дим, кардамон", middleNotes: "Кедр, ладан", baseNotes: "Бензоїн, амбра",
    variants: [{ id: "v1", volume: "30 мл", price: 2450, salePrice: 2090 }, { id: "v2", volume: "50 мл", price: 3480, salePrice: 2980 }] },
];

// A lightweight brand directory — enough to power a future "За брендами"
// page (name + short description). Kept as a plain name match against
// products (not a foreign key) so the admin flow stays simple: type the
// same brand name on a product and it groups automatically.
const SEED_BRANDS = [
  { id: "b1", name: "Maison Cendre", description: "Попіл і папір: тепла деревна лінія для тих, хто любить тишу." },
  { id: "b2", name: "Sel Noir", description: "Солоний вітер і чорний перець — морська сторона архіву." },
  { id: "b3", name: "Atelier Nomade", description: "Легкі, сонячні композиції для щоденного носіння." },
  { id: "b4", name: "Verte & Fils", description: "Квіткові та цитрусові акорди, зіткані з ранкового світла." },
];

const SEED_REVIEWS = [
  { id: "r1", productId: "p1", author: "Олена", rating: 5, text: "Саме той аромат, що тримається на одязі до вечора. Дуже тепла деревна база.", createdAt: "2026-06-02T10:00:00.000Z", approved: true },
  { id: "r2", productId: "p1", author: "Максим", rating: 4, text: "Гарний, але хотілось би трохи більше стійкості взимку.", createdAt: "2026-07-14T10:00:00.000Z", approved: true },
  { id: "r3", productId: "p5", author: "Ірина", rating: 5, text: "Чоловік у захваті, купуємо вже другий флакон.", createdAt: "2026-05-20T10:00:00.000Z", approved: true },
];

const SEED_COLLECTIONS = [
  { id: "c1", name: "Подарунок для нього", description: "Впевнені чоловічі аромати для особливого випадку.", productIds: ["p2", "p5", "p9", "p10"] },
  { id: "c2", name: "Перше знайомство з архівом", description: "З чого почати, якщо ви новачок у ніші.", productIds: ["p1", "p7", "p8"] },
];

const SEED_SETTINGS = { heroImage: null, heroVideo: null, heroZoom: 100, heroPosX: 50, heroPosY: 50 };

export async function getDb() {
  const db = await JSONFilePreset("db.json", {
    products: SEED_PRODUCTS, brands: SEED_BRANDS, orders: [],
    reviews: SEED_REVIEWS, collections: SEED_COLLECTIONS, settings: SEED_SETTINGS,
  });
  // backfill for anyone re-running against an older db.json from before these existed
  if (!db.data.brands) { db.data.brands = SEED_BRANDS; await db.write(); }
  if (!db.data.reviews) { db.data.reviews = SEED_REVIEWS; await db.write(); }
  if (!db.data.collections) { db.data.collections = SEED_COLLECTIONS; await db.write(); }
  if (!db.data.settings) { db.data.settings = SEED_SETTINGS; await db.write(); }
  return db;
}
