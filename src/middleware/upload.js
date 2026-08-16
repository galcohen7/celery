// קליטת מסמך רגיש להעלאה — **לזיכרון בלבד**.
//
// זו ההחלטה המחייבת ביותר בפרויקט (spec.md סעיף 4): תלוש שכר ודוח עו״ש
// מכילים מספר ת״ז, מספר חשבון וכתובת. הם עולים, מנותחים, ונעלמים.
//
// memoryStorage ולא diskStorage — עם diskStorage הקובץ נכתב לתיקייה זמנית
// ונשאר שם עד שמישהו זוכר למחוק. כאן אין קובץ למחוק: ה-Buffer משוחרר
// כשהבקשה מסתיימת. אין נתיב קוד שכותב מסמך גולמי לדיסק או למסד.

const multer = require("multer");

const MAX_BYTES = 20 * 1024 * 1024; // 20MB — מתחת למגבלת הבקשה של ה-API
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new Error("סוג קובץ לא נתמך. יש להעלות PDF, PNG, JPG או WEBP."));
    }
    cb(null, true);
  },
});

// multer זורק שגיאות עם שמות משלו; בלי תרגום הן מגיעות למשתמש כ-500 סתום.
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "הקובץ גדול מ-20MB. נסה להעלות עמוד אחד בכל פעם." });
    }
    return res.status(400).json({ error: "שגיאה בהעלאת הקובץ." });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
}

module.exports = { upload, handleUploadErrors, MAX_BYTES, ALLOWED };
