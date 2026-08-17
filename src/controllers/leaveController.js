const prisma = require("../config/db");
const { buildBalances } = require("../services/leave");

// GET /api/leave/balance
async function balance(req, res) {
  const [latest, wage, months] = await Promise.all([
    prisma.payslipAnalysis.findFirst({ where: { userId: req.userId }, orderBy: { month: "desc" } }),
    prisma.wageProfile.findUnique({ where: { userId: req.userId } }),
    prisma.workDay.findMany({ where: { userId: req.userId }, select: { date: true } }),
  ]);
  // חודשים שיש בהם לפחות יום עבודה אחד ביומן
  const monthsWorked = new Set(months.map((d) => d.date.slice(0, 7))).size;
  res.json(buildBalances(latest, wage || {}, monthsWorked));
}

module.exports = { balance };
