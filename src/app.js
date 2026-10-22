require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// מנוע השכר משותף ללקוח: אותו קובץ בדיוק, עטוף כך שירוץ בדפדפן תחת
// window.SalaryEngine. עד כאן ללקוח היה מנוע משלו עם 40 ₪ קבועים בקוד,
// והוא התעלם מתנאי מקום העבודה. ככה יש מקור אמת אחד.
const salarySrc = fs.readFileSync(path.join(__dirname, "services", "salary.js"), "utf8");
app.get("/salary.js", (req, res) => {
  res.type("application/javascript").send(
    `window.SalaryEngine=(function(){var module={exports:{}};\n${salarySrc}\nreturn module.exports;})();`
  );
});

// הגשת הלקוח (public/index.html) מאותו מקור כמו ה-API
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/workdays", require("./routes/workdayRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/documents", require("./routes/documentRoutes"));
app.use("/api/jobs", require("./routes/jobRoutes"));
app.use("/api/leave", require("./routes/leaveRoutes"));
app.use("/api/tax", require("./routes/taxRoutes"));

// טיפול בנתיב לא קיים
app.use((req, res) => res.status(404).json({ error: "לא נמצא" }));

// טיפול בשגיאות
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "שגיאת שרת" });
});

module.exports = app;
