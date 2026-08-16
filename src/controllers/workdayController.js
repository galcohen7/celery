const prisma = require("../config/db");
const { computeSalary, defaults, dowOf, HEB_DAYS } = require("../services/salary");

// GET /api/workdays
async function list(req, res) {
  const days = await prisma.workDay.findMany({
    where: { userId: req.userId },
    orderBy: { date: "asc" },
  });
  res.json(days.map((d) => ({ ...d, dayName: HEB_DAYS[d.dow] })));
}

// POST /api/workdays  — יוצר או מעדכן יום לפי התאריך
async function upsert(req, res) {
  const { date } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return res.status(400).json({ error: "תאריך לא תקין" });

  const dow = dowOf(date);
  const def = defaults(dow);
  const start = req.body.start || def.start;
  const end = req.body.end || def.end;
  const computed = computeSalary(date, start, end);

  // אם נשלח שכר ידני — מכבדים אותו; אחרת מחשבים
  const salary = req.body.salary != null ? Number(req.body.salary) : computed.salary;

  const day = await prisma.workDay.upsert({
    where: { userId_date: { userId: req.userId, date } },
    create: { userId: req.userId, date, dow, start, end, salary },
    update: { dow, start, end, salary },
  });

  res.json({ ...day, dayName: HEB_DAYS[day.dow], breakdown: computed });
}

// DELETE /api/workdays/:date
async function remove(req, res) {
  await prisma.workDay.deleteMany({ where: { userId: req.userId, date: req.params.date } });
  res.json({ ok: true });
}

module.exports = { list, upsert, remove };
