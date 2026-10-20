const prisma = require("../config/db");
const { computeSalary, defaults, dowOf, HEB_DAYS } = require("../services/salary");
const { activeJob } = require("./jobController");

// כל יום עבודה שייך למקום עבודה. בלי זה אי אפשר לדעת לפי אילו תעריפים
// לחשב אותו, ואי אפשר להפריד בין שני מקומות שעובדים בהם באותו יום.
async function resolveJob(userId, jobId) {
  if (jobId != null) {
    const id = Number(jobId);
    if (!Number.isInteger(id)) return null;
    return prisma.job.findFirst({ where: { id, userId, archivedAt: null } });
  }
  return activeJob(userId);
}

// GET /api/workdays?jobId=
async function list(req, res) {
  const where = { userId: req.userId };
  if (req.query.jobId) where.jobId = Number(req.query.jobId);

  const days = await prisma.workDay.findMany({ where, orderBy: { date: "asc" } });
  res.json(days.map((d) => ({ ...d, dayName: HEB_DAYS[d.dow] })));
}

// POST /api/workdays — יוצר או מעדכן יום במקום העבודה הפעיל (או ב-jobId שנשלח)
async function upsert(req, res) {
  const { date } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return res.status(400).json({ error: "תאריך לא תקין" });

  const job = await resolveJob(req.userId, req.body.jobId);
  if (!job) {
    return res.status(409).json({
      error: "אין מקום עבודה מוגדר. יש להוסיף אחד לפני הזנת ימים.",
      needsOnboarding: true,
    });
  }

  const dow = dowOf(date);
  const def = defaults(job);
  const start = req.body.start || def.start;
  const end = req.body.end || def.end;
  const isHoliday = Boolean(req.body.isHoliday);
  // התעריפים מגיעים ממקום העבודה, לא מקבועים בקוד
  const computed = computeSalary(date, start, end, job, isHoliday);

  // שכר ידני גובר על החישוב — כך נשמרות עריכות של המשתמש
  const salary = req.body.salary != null ? Number(req.body.salary) : computed.salary;

  const day = await prisma.workDay.upsert({
    where: { userId_jobId_date: { userId: req.userId, jobId: job.id, date } },
    create: { userId: req.userId, jobId: job.id, date, dow, start, end, salary },
    update: { dow, start, end, salary },
  });

  res.json({ ...day, dayName: HEB_DAYS[day.dow], breakdown: computed, jobName: job.name });
}

// DELETE /api/workdays/:date?jobId=
async function remove(req, res) {
  const job = await resolveJob(req.userId, req.query.jobId);
  const where = { userId: req.userId, date: req.params.date };
  if (job) where.jobId = job.id;

  await prisma.workDay.deleteMany({ where });
  res.json({ ok: true });
}

module.exports = { list, upsert, remove };
