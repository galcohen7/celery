require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// הגשת הלקוח (public/index.html) מאותו מקור כמו ה-API
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/workdays", require("./routes/workdayRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/documents", require("./routes/documentRoutes"));

// טיפול בנתיב לא קיים
app.use((req, res) => res.status(404).json({ error: "לא נמצא" }));

// טיפול בשגיאות
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "שגיאת שרת" });
});

module.exports = app;
