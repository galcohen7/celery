const jwt = require("jsonwebtoken");

// מאמת טוקן מכותרת Authorization ומצרף את req.userId
module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "נדרשת התחברות" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: "טוקן לא תקין או שפג תוקפו" });
  }
};
