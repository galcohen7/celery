const prisma = require("../config/db");
const { computeSalary, defaults, withDefaults, DEFAULT_PROFILE } = require("../services/salary");

const MODES = new Set(["PERCENT", "ABSOLUTE"]);
const PAY_TYPES = new Set(["HOURLY", "MONTHLY"]);
const NAME_MAX = 60;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function publicJob(j) {
  const { userId, ...rest } = j;
  return rest;
}

function validate(b, { requireName = false } = {}) {
  const name = String(b.name ?? "").trim();
  if (requireName && !name) return "יש לתת שם למקום העבודה";
  if (name.length > NAME_MAX) return `השם ארוך מ-${NAME_MAX} תווים`;
  if (b.payType && !PAY_TYPES.has(b.payType)) return "סוג שכר לא תקין";
  for (const f of ["overtimeMode", "weekendMode", "holidayMode"])
    if (b[f] && !MODES.has(b[f])) return "אופן חישוב לא תקין";

  const num = (v, min, max, label) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max ? null : `${label} מחוץ לטווח הסביר`;
  };
  let e;
  if ((e = num(b.hourlyRate ?? 40, 0, 10000, "תעריף שעתי"))) return e;
  if (b.payType === "MONTHLY" && (b.monthlySalary == null || b.monthlySalary === ""))
    return "בשכר חודשי יש להזין את הסכום";
  if (b.monthlySalary != null && b.monthlySalary !== "" && (e = num(b.monthlySalary, 0, 1000000, "שכר חודשי"))) return e;
  for (const [mode, val, label] of [
    [b.overtimeMode, b.overtimeValue, "מכפיל שעות נוספות"],
    [b.weekendMode, b.weekendValue, "תעריף סוף שבוע"],
    [b.holidayMode, b.holidayValue, "תעריף חג"],
  ]) {
    if (val == null) continue;
    if ((e = num(val, 0, mode === "ABSOLUTE" ? 10000 : 1000, label))) return e;
  }
  if ((e = num(b.overtimeThresholdHours ?? 8, 0, 24, "סף שעות נוספות"))) return e;
  for (const f of ["defaultStart", "defaultEnd"])
    if (b[f] != null && b[f] !== "" && !TIME_RE.test(b[f])) return "שעת ברירת מחדל לא תקינה";
  if (b.annualVacationDays != null && b.annualVacationDays !== "" &&
      (e = num(b.annualVacationDays, 0, 100, "ימי חופשה שנתיים"))) return e;
  return null;
}

function toData(b) {
  const m = { ...DEFAULT_PROFILE, ...b };
  return {
    name: String(b.name ?? "").trim() || "מקום עבודה",
    employer: b.employer ? String(b.employer).trim().slice(0, 80) : null,
    payType: m.payType,
    hourlyRate: Number(m.hourlyRate),
    monthlySalary: m.monthlySalary == null || m.monthlySalary === "" ? null : Number(m.monthlySalary),
    overtimeMode: m.overtimeMode, overtimeValue: Number(m.overtimeValue),
    weekendMode: m.weekendMode, weekendValue: Number(m.weekendValue),
    holidayMode: m.holidayMode, holidayValue: Number(m.holidayValue),
    overtimeThresholdHours: Number(m.overtimeThresholdHours),
    defaultStart: m.defaultStart || DEFAULT_PROFILE.defaultStart,
    defaultEnd: m.defaultEnd || DEFAULT_PROFILE.defaultEnd,
    weekendStartDow: Number(m.weekendStartDow), weekendStartHour: Number(m.weekendStartHour),
    weekendEndDow: Number(m.weekendEndDow), weekendEndHour: Number(m.weekendEndHour),
    annualVacationDays: b.annualVacationDays == null || b.annualVacationDays === "" ? null : Number(b.annualVacationDays),
    sickAccrualPerMonth: Number(m.sickAccrualPerMonth ?? 1.5),
    sickAccrualCap: Number(m.sickAccrualCap ?? 90),
  };
}

// GET /api/jobs — כולל ספירת ימים, כדי שהממשק ידע מה מחיקה תעלה
async function list(req, res) {
  const jobs = await prisma.job.findMany({
    where: { userId: req.userId, archivedAt: null },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { workdays: true } } },
  });
  res.json({
    jobs: jobs.map((j) => ({ ...publicJob(j), workdayCount: j._count.workdays })),
    needsOnboarding: jobs.length === 0,
  });
}

// POST /api/jobs
async function create(req, res) {
  const err = validate(req.body || {}, { requireName: true });
  if (err) return res.status(400).json({ error: err });

  const count = await prisma.job.count({ where: { userId: req.userId, archivedAt: null } });
  const job = await prisma.job.create({
    data: { userId: req.userId, ...toData(req.body), isActive: count === 0 },
  });
  res.status(201).json({ job: publicJob(job) });
}

// PUT /api/jobs/:id
async function update(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "מזהה לא תקין" });
  const err = validate(req.body || {}, { requireName: true });
  if (err) return res.status(400).json({ error: err });

  // updateMany עם סינון userId — update לפי id בלבד היה מאפשר עריכת
  // מקום עבודה של משתמש אחר.
  const { count } = await prisma.job.updateMany({
    where: { id, userId: req.userId, archivedAt: null },
    data: toData(req.body),
  });
  if (!count) return res.status(404).json({ error: "מקום העבודה לא נמצא" });
  res.json({ job: publicJob(await prisma.job.findUnique({ where: { id } })) });
}

// POST /api/jobs/:id/activate
async function activate(req, res) {
  const id = Number(req.params.id);
  const job = await prisma.job.findFirst({ where: { id, userId: req.userId, archivedAt: null } });
  if (!job) return res.status(404).json({ error: "מקום העבודה לא נמצא" });

  await prisma.$transaction([
    prisma.job.updateMany({ where: { userId: req.userId }, data: { isActive: false } }),
    prisma.job.update({ where: { id }, data: { isActive: true } }),
  ]);
  res.json({ ok: true, activeJobId: id });
}

// DELETE /api/jobs/:id
//
// מקום עבודה עם ימי עבודה **מאורכב ולא נמחק**. מחיקה הייתה מוחקת איתו
// היסטוריית שכר שלמה בלי דרך לשחזר. ארכוב מעלים אותו מהממשק ומשאיר
// את הנתונים. מחיקה אמיתית מותרת רק כשאין מה לאבד.
async function remove(req, res) {
  const id = Number(req.params.id);
  const job = await prisma.job.findFirst({
    where: { id, userId: req.userId, archivedAt: null },
    include: { _count: { select: { workdays: true } } },
  });
  if (!job) return res.status(404).json({ error: "מקום העבודה לא נמצא" });

  const days = job._count.workdays;
  if (days > 0) {
    await prisma.job.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } });
  } else {
    await prisma.job.delete({ where: { id } });
  }

  // אם המקום הפעיל ירד — מעבירים את הדגל למקום אחר, אחרת היומן נשאר בלי הקשר
  const remaining = await prisma.job.findMany({ where: { userId: req.userId, archivedAt: null } });
  if (remaining.length && !remaining.some((j) => j.isActive)) {
    await prisma.job.update({ where: { id: remaining[0].id }, data: { isActive: true } });
  }

  res.json({ ok: true, archived: days > 0, workdaysKept: days });
}

// POST /api/jobs/preview — תצוגה מקדימה בלי לשמור
function preview(req, res) {
  const profile = req.body?.profile || {};
  // הדוגמאות רצות על שעות ברירת המחדל של אותו מקום עבודה, אחרת התצוגה
  // המקדימה מראה משמרת שהמשתמש לא מזין בפועל.
  const { start, end } = defaults(profile);
  const samples = [
    { label: "יום חול (א׳–ה׳)", date: "2026-08-10", holiday: false },
    { label: "שישי", date: "2026-08-14", holiday: false },
    { label: "שבת", date: "2026-08-15", holiday: false },
    { label: "חג", date: "2026-08-10", holiday: true },
  ].map((x) => ({ ...x, start, end }));
  res.json({
    samples: samples.map((s) => {
      const r = computeSalary(s.date, s.start, s.end, profile, s.holiday);
      return { label: s.label, shift: `${s.start}–${s.end}`, salary: r.salary };
    }),
  });
}

// עזר משותף: מקום העבודה הפעיל, או הראשון אם אין דגל
async function activeJob(userId) {
  return (
    (await prisma.job.findFirst({ where: { userId, isActive: true, archivedAt: null } })) ||
    (await prisma.job.findFirst({ where: { userId, archivedAt: null }, orderBy: { createdAt: "asc" } }))
  );
}

module.exports = { list, create, update, activate, remove, preview, activeJob };
