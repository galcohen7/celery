const prisma = require("../config/db");
const { computeDeductions, availableYears, getRates } = require("../services/tax/engine");

const DEFAULT_YEAR = 2026;

function publicProfile(p) {
  return {
    creditPoints: p?.creditPoints ?? 2.25,
    pensionPercent: p?.pensionPercent ?? 0,
    exemptions: p ? JSON.parse(p.exemptions) : [],
  };
}

// GET /api/tax/profile
async function getProfile(req, res) {
  const p = await prisma.taxProfile.findUnique({ where: { userId: req.userId } });
  res.json({ profile: publicProfile(p), isDefault: !p });
}

// PUT /api/tax/profile
async function saveProfile(req, res) {
  const creditPoints = Number(req.body?.creditPoints);
  const pensionPercent = Number(req.body?.pensionPercent ?? 0);

  if (!Number.isFinite(creditPoints) || creditPoints < 0 || creditPoints > 20)
    return res.status(400).json({ error: "מספר נקודות זיכוי לא סביר" });
  if (!Number.isFinite(pensionPercent) || pensionPercent < 0 || pensionPercent > 25)
    return res.status(400).json({ error: "אחוז פנסיה לא סביר" });

  const exemptions = JSON.stringify(Array.isArray(req.body?.exemptions) ? req.body.exemptions : []);
  const data = { creditPoints, pensionPercent, exemptions };

  const p = await prisma.taxProfile.upsert({
    where: { userId: req.userId },
    create: { userId: req.userId, ...data },
    update: data,
  });
  res.json({ profile: publicProfile(p) });
}

// POST /api/tax/calculate — { grossShekels, year? }
// משתמש בפרופיל השמור אלא אם נשלחו ערכים מפורשים, כדי שהמסך יוכל
// להראות "מה יקרה אם" בלי לשמור.
async function calculate(req, res) {
  const gross = Number(req.body?.grossShekels);
  if (!Number.isFinite(gross) || gross < 0)
    return res.status(400).json({ error: "יש להזין ברוטו תקין" });

  const stored = await prisma.taxProfile.findUnique({ where: { userId: req.userId } });
  const base = publicProfile(stored);
  const profile = {
    creditPoints: req.body?.creditPoints != null ? Number(req.body.creditPoints) : base.creditPoints,
    pensionPercent: req.body?.pensionPercent != null ? Number(req.body.pensionPercent) : base.pensionPercent,
  };

  const year = Number(req.body?.year || DEFAULT_YEAR);
  try {
    res.json(computeDeductions(gross, profile, year));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /api/tax/rates — שקיפות: מאיפה הגיעו המספרים
function rates(req, res) {
  const year = Number(req.query.year || DEFAULT_YEAR);
  try {
    const r = getRates(year);
    res.json({ year, meta: r._meta, availableYears: availableYears() });
  } catch (err) {
    res.status(404).json({ error: err.message, availableYears: availableYears() });
  }
}

module.exports = { getProfile, saveProfile, calculate, rates };
