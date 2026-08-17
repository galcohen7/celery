const prisma = require("../config/db");
const { computeSalary, withDefaults, DEFAULT_PROFILE } = require("../services/salary");

const MODES = new Set(["PERCENT", "ABSOLUTE"]);
const PAY_TYPES = new Set(["HOURLY", "MONTHLY"]);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function publicProfile(p) {
  const { id, userId, updatedAt, ...rest } = p || {};
  return withDefaults(p ? rest : null);
}

function validate(b) {
  const num = (v, min, max, name) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) return `${name} מחוץ לטווח הסביר`;
    return null;
  };
  if (b.payType && !PAY_TYPES.has(b.payType)) return "סוג שכר לא תקין";
  for (const f of ["overtimeMode", "weekendMode", "holidayMode"])
    if (b[f] && !MODES.has(b[f])) return "אופן חישוב לא תקין";

  let e;
  if ((e = num(b.hourlyRate ?? 40, 0, 10000, "תעריף שעתי"))) return e;
  if (b.monthlySalary != null && (e = num(b.monthlySalary, 0, 1000000, "שכר חודשי"))) return e;
  // אחוזים עד 1000%, סכומים מוחלטים עד 10,000 ש"ח לשעה
  for (const [mode, val, name] of [
    [b.overtimeMode, b.overtimeValue, "מכפיל שעות נוספות"],
    [b.weekendMode, b.weekendValue, "תעריף סוף שבוע"],
    [b.holidayMode, b.holidayValue, "תעריף חג"],
  ]) {
    if (val == null) continue;
    const max = mode === "ABSOLUTE" ? 10000 : 1000;
    if ((e = num(val, 0, max, name))) return e;
  }
  if ((e = num(b.overtimeThresholdHours ?? 8, 0, 24, "סף שעות נוספות"))) return e;
  if (b.fridayPaidUntil != null && b.fridayPaidUntil !== "" && !TIME_RE.test(b.fridayPaidUntil))
    return "שעת תשלום שישי לא תקינה";
  return null;
}

// GET /api/wage/profile
async function getProfile(req, res) {
  const p = await prisma.wageProfile.findUnique({ where: { userId: req.userId } });
  res.json({ profile: publicProfile(p), isDefault: !p, defaults: DEFAULT_PROFILE });
}

// PUT /api/wage/profile
async function saveProfile(req, res) {
  const err = validate(req.body || {});
  if (err) return res.status(400).json({ error: err });

  const b = { ...DEFAULT_PROFILE, ...req.body };
  const data = {
    payType: b.payType,
    hourlyRate: Number(b.hourlyRate),
    monthlySalary: b.monthlySalary == null || b.monthlySalary === "" ? null : Number(b.monthlySalary),
    overtimeMode: b.overtimeMode, overtimeValue: Number(b.overtimeValue),
    weekendMode: b.weekendMode, weekendValue: Number(b.weekendValue),
    holidayMode: b.holidayMode, holidayValue: Number(b.holidayValue),
    overtimeThresholdHours: Number(b.overtimeThresholdHours),
    weekendStartDow: Number(b.weekendStartDow), weekendStartHour: Number(b.weekendStartHour),
    weekendEndDow: Number(b.weekendEndDow), weekendEndHour: Number(b.weekendEndHour),
    fridayPaidUntil: b.fridayPaidUntil === "" ? null : b.fridayPaidUntil,
  };

  const p = await prisma.wageProfile.upsert({
    where: { userId: req.userId },
    create: { userId: req.userId, ...data },
    update: data,
  });
  res.json({ profile: publicProfile(p) });
}

// POST /api/wage/preview — תצוגה מקדימה בלי לשמור.
// חשוב: זה הדבר היחיד שמראה למשתמש מה שינוי בפרופיל יעשה, בלי לגעת
// בימים הקיימים (spec.md 5.2 — אין חישוב מחדש אוטומטי).
async function preview(req, res) {
  const profile = req.body?.profile || {};
  const samples = [
    { label: "יום חול (א׳–ה׳)", date: "2026-08-10", start: "15:00", end: "23:00", holiday: false },
    { label: "שישי", date: "2026-08-14", start: "15:00", end: "19:00", holiday: false },
    { label: "שבת", date: "2026-08-15", start: "15:00", end: "23:00", holiday: false },
    { label: "חג", date: "2026-08-10", start: "15:00", end: "23:00", holiday: true },
  ];
  res.json({
    samples: samples.map((s) => {
      const r = computeSalary(s.date, s.start, s.end, profile, s.holiday);
      return { label: s.label, shift: `${s.start}–${s.end}`, salary: r.salary, breakdown: r };
    }),
  });
}

module.exports = { getProfile, saveProfile, preview };
