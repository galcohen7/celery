const prisma = require("../config/db");
const { CATEGORIES, suggestCategory, normalizeCategory } = require("../services/expenseCategory");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DESC_MAX = 200;
const MERCHANT_MAX = 80;
// תקרה שפויה: 10 מיליון ש"ח. תופסת טעויות הקלדה (אגורות שהוזנו כשקלים)
// לפני שהן מעוותות את הדוח החודשי.
const MAX_AGOROT = 1_000_000_000;

// ממיר את גוף הבקשה לשדות תקינים, או מחזיר { error }.
// משותף ליצירה ולעדכון כדי שהכללים לא יתפצלו.
function parseBody(body) {
  const date = String(body?.date || "");
  if (!DATE_RE.test(date)) return { error: "תאריך לא תקין" };

  // הלקוח שולח שקלים (42.9); המסד שומר אגורות (4290).
  const shekels = Number(body?.amount);
  if (!Number.isFinite(shekels) || shekels <= 0) return { error: "יש להזין סכום גדול מאפס" };
  const amountAgorot = Math.round(shekels * 100);
  if (amountAgorot > MAX_AGOROT) return { error: "הסכום גדול מדי" };

  const description = String(body?.description || "").trim();
  if (!description) return { error: "יש להזין תיאור" };
  if (description.length > DESC_MAX) return { error: `התיאור ארוך מ-${DESC_MAX} תווים` };

  const merchant = String(body?.merchant || "").trim().slice(0, MERCHANT_MAX) || null;

  // קטגוריה שנשלחה במפורש גוברת; אחרת נגזרת מהתיאור.
  const category = body?.category
    ? normalizeCategory(body.category)
    : suggestCategory(description, merchant);

  return { data: { date, amountAgorot, description, category, merchant } };
}

// GET /api/expenses
async function list(req, res) {
  const rows = await prisma.expense.findMany({
    where: { userId: req.userId },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  res.json(rows);
}

// GET /api/expenses/categories — הרשימה שהלקוח ממלא בה את התפריט
function categories(req, res) {
  res.json({ categories: CATEGORIES });
}

// POST /api/expenses/suggest-category — הצעה חיה בזמן הקלדה
function suggest(req, res) {
  res.json({ category: suggestCategory(req.body?.description, req.body?.merchant) });
}

// POST /api/expenses
async function create(req, res) {
  const { error, data } = parseBody(req.body);
  if (error) return res.status(400).json({ error });

  const row = await prisma.expense.create({ data: { ...data, userId: req.userId } });
  res.status(201).json(row);
}

// PUT /api/expenses/:id
async function update(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "מזהה לא תקין" });

  const { error, data } = parseBody(req.body);
  if (error) return res.status(400).json({ error });

  // updateMany ולא update — הסינון ב-userId מונע עריכה של הוצאה של משתמש אחר.
  // update לפי id בלבד היה מאפשר את זה.
  const { count } = await prisma.expense.updateMany({
    where: { id, userId: req.userId },
    data,
  });
  if (!count) return res.status(404).json({ error: "ההוצאה לא נמצאה" });

  res.json(await prisma.expense.findUnique({ where: { id } }));
}

// DELETE /api/expenses/:id
async function remove(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "מזהה לא תקין" });

  const { count } = await prisma.expense.deleteMany({ where: { id, userId: req.userId } });
  if (!count) return res.status(404).json({ error: "ההוצאה לא נמצאה" });
  res.json({ ok: true });
}

module.exports = { list, categories, suggest, create, update, remove };
