const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../config/db");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// POST /api/auth/register
async function register(req, res) {
  const { email, password } = req.body || {};
  if (!EMAIL_RE.test(email || "")) return res.status(400).json({ error: "אימייל לא תקין" });
  if (!password || password.length < 6) return res.status(400).json({ error: "הסיסמה חייבת 6 תווים לפחות" });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: "אימייל זה כבר רשום" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  res.status(201).json({ token: signToken(user.id), user: { id: user.id, email: user.email } });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email: email || "" } });
  if (!user) return res.status(401).json({ error: "אימייל או סיסמה שגויים" });

  const ok = await bcrypt.compare(password || "", user.passwordHash);
  if (!ok) return res.status(401).json({ error: "אימייל או סיסמה שגויים" });

  res.json({ token: signToken(user.id), user: { id: user.id, email: user.email } });
}

// POST /api/auth/forgot-password
async function requestPasswordReset(req, res) {
  const { email } = req.body || {};
  const user = await prisma.user.findUnique({ where: { email: email || "" } });

  // תמיד מחזירים ok כדי לא לחשוף אילו אימיילים רשומים במערכת
  if (user) {
    const raw = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 דקות
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

    // בפרודקשן: לשלוח את הקישור במייל. בפיתוח: מדפיסים ומחזירים את הטוקן.
    console.log(`[DEV] reset token for ${email}: ${raw}`);
    if (process.env.NODE_ENV !== "production") {
      return res.json({ ok: true, devToken: raw });
    }
  }
  res.json({ ok: true });
}

// POST /api/auth/reset-password
async function resetPassword(req, res) {
  const { token, password } = req.body || {};
  if (!password || password.length < 6) return res.status(400).json({ error: "הסיסמה חייבת 6 תווים לפחות" });

  const tokenHash = crypto.createHash("sha256").update(token || "").digest("hex");
  const rec = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, used: false, expiresAt: { gt: new Date() } },
  });
  if (!rec) return res.status(400).json({ error: "קוד איפוס לא תקין או שפג תוקפו" });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: rec.id }, data: { used: true } }),
  ]);
  res.json({ ok: true });
}

module.exports = { register, login, requestPasswordReset, resetPassword };
