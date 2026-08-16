const prisma = require("../config/db");
const ai = require("../services/ai/client");
const { extractPayslip } = require("../services/ai/payslip");
const { extractStatement } = require("../services/ai/statement");
const { compareToJournal } = require("../services/payslipCompare");
const { reconcile, findRecurring } = require("../services/reconcile");
const { suggestCategory } = require("../services/expenseCategory");

const MONTH_RE = /^\d{4}-\d{2}$/;

// כל נתיבי הניתוח מחזירים **טיוטה** ואינם שומרים דבר. השמירה קורית רק
// ב-confirm, אחרי שהמשתמש ראה ואישר (spec.md סעיף 4).
//
// ה-Buffer של המסמך חי רק במשך הבקשה. אין כאן כתיבה לדיסק, אין שמירה
// במסד, ואין לוג של תוכן המסמך — רק מזהה משתמש, חודש ותוצאה.

// GET /api/documents/status
function status(req, res) {
  res.json({ aiConfigured: ai.isConfigured(), model: ai.MODEL });
}

function requireMonth(month) {
  return MONTH_RE.test(String(month || "")) ? null : "יש לבחור חודש תקין";
}

// ממיר שגיאות שירות לתשובות HTTP מובנות במקום 500 סתום
function aiError(res, err) {
  if (err instanceof ai.AiUnavailableError) return res.status(503).json({ error: err.message });
  if (err instanceof ai.AiRefusedError) return res.status(422).json({ error: err.message });
  return res.status(502).json({ error: err.message || "ניתוח המסמך נכשל." });
}

// POST /api/documents/payslip  (multipart: file, month)
async function analyzePayslip(req, res) {
  const bad = requireMonth(req.body?.month);
  if (bad) return res.status(400).json({ error: bad });
  if (!req.file) return res.status(400).json({ error: "לא צורף קובץ" });

  const month = req.body.month;
  let extracted, usage;
  try {
    ({ data: extracted, usage } = await extractPayslip(req.file.buffer, req.file.mimetype));
  } catch (err) {
    return aiError(res, err);
  } finally {
    req.file.buffer = null; // שחרור מפורש; אין עותק אחר בשום מקום
  }

  const workdays = await prisma.workDay.findMany({
    where: { userId: req.userId, date: { startsWith: month } },
    orderBy: { date: "asc" },
  });

  const comparison = compareToJournal(extracted, workdays);

  res.json({
    draft: true,
    month,
    extracted,
    comparison,
    usage,
    note: "המסמך לא נשמר. אישור יישמור את התוצאות בלבד.",
  });
}

// POST /api/documents/payslip/confirm  (JSON)
async function confirmPayslip(req, res) {
  const { month, extracted, comparison } = req.body || {};
  const bad = requireMonth(month);
  if (bad) return res.status(400).json({ error: bad });
  if (!extracted) return res.status(400).json({ error: "אין נתונים לשמירה" });

  const toAgorot = (s) => (s == null ? null : Math.round(Number(s) * 100));
  const data = {
    userId: req.userId,
    month,
    grossAgorot: toAgorot(extracted.grossShekels),
    netAgorot: toAgorot(extracted.netShekels),
    deductions: JSON.stringify(extracted.deductions || {}),
    hoursReported: extracted.hoursReported ?? null,
    daysReported: extracted.daysReported ?? null,
    comparison: JSON.stringify(comparison?.journal || {}),
    alerts: JSON.stringify(comparison?.alerts || []),
    reportText: "",
  };

  const saved = await prisma.payslipAnalysis.upsert({
    where: { userId_month: { userId: req.userId, month } },
    create: data,
    update: data,
  });
  res.status(201).json(saved);
}

// GET /api/documents/payslips
async function listPayslips(req, res) {
  const rows = await prisma.payslipAnalysis.findMany({
    where: { userId: req.userId },
    orderBy: { month: "desc" },
  });
  res.json(rows.map((r) => ({
    ...r,
    deductions: JSON.parse(r.deductions),
    comparison: JSON.parse(r.comparison),
    alerts: JSON.parse(r.alerts),
  })));
}

// POST /api/documents/statement  (multipart: file)
async function analyzeStatement(req, res) {
  if (!req.file) return res.status(400).json({ error: "לא צורף קובץ" });

  let extracted, usage;
  try {
    ({ data: extracted, usage } = await extractStatement(req.file.buffer, req.file.mimetype));
  } catch (err) {
    return aiError(res, err);
  } finally {
    req.file.buffer = null;
  }

  const lines = (extracted.lines || []).map((l) => ({
    date: l.date,
    amountAgorot: Math.round(Number(l.amountShekels) * 100),
    merchantRaw: l.merchantRaw,
  }));

  // מצליבים רק מול הוצאות מהטווח הרלוונטי, לא מול כל ההיסטוריה
  const dates = lines.map((l) => l.date).sort();
  const expenses = dates.length
    ? await prisma.expense.findMany({
        where: { userId: req.userId, date: { gte: shiftDays(dates[0], -7), lte: shiftDays(dates[dates.length - 1], 7) } },
      })
    : [];

  const { results, unmatchedExpenses, summary } = reconcile(lines, expenses);

  res.json({
    draft: true,
    summary,
    results,
    unmatchedExpenses,
    recurring: findRecurring(lines),
    unreadableRowCount: extracted.unreadableRowCount || 0,
    usage,
    note: "הדוח לא נשמר. אישור יישמור את השורות בלבד.",
  });
}

// POST /api/documents/statement/confirm  (JSON: results[])
async function confirmStatement(req, res) {
  const results = Array.isArray(req.body?.results) ? req.body.results : null;
  if (!results) return res.status(400).json({ error: "אין שורות לשמירה" });
  // גם השורות שהמשתמש בחר להפוך להוצאות
  const createExpenses = Array.isArray(req.body?.createExpenses) ? req.body.createExpenses : [];

  const savedLines = await prisma.$transaction(
    results.map((r) =>
      prisma.statementLine.create({
        data: {
          userId: req.userId,
          date: r.line.date,
          amountAgorot: r.line.amountAgorot,
          merchantRaw: r.line.merchantRaw,
          matchStatus: r.status,
          matchedExpenseId: r.matchedExpenseId ?? null,
          confidence: r.confidence ?? null,
          alertReason: r.alertReason ?? null,
        },
      })
    )
  );

  // שורות שהמשתמש אישר להפוך להוצאה שנרשמה
  let created = 0;
  if (createExpenses.length) {
    await prisma.$transaction(
      createExpenses.map((l) =>
        prisma.expense.create({
          data: {
            userId: req.userId,
            date: l.date,
            amountAgorot: l.amountAgorot,
            description: l.merchantRaw,
            category: suggestCategory(l.merchantRaw, l.merchantRaw),
            merchant: l.merchantRaw,
            source: "STATEMENT",
          },
        })
      )
    );
    created = createExpenses.length;
  }

  res.status(201).json({ ok: true, savedLines: savedLines.length, createdExpenses: created });
}

function shiftDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

module.exports = {
  status, analyzePayslip, confirmPayslip, listPayslips,
  analyzeStatement, confirmStatement,
};
