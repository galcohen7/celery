// רגרסיה לבאג: לוח השנה תמחר כל יום ב-40 ₪ לשעה, לא משנה מה הוגדר.
// הלקוח החזיק מנוע משלו עם תעריפים קבועים. עכשיו הוא טוען את מנוע השרת
// דרך /salary.js — הבדיקה מריצה את הקובץ המוגש כמו בדפדפן.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const vm = require("node:vm");
const app = require("../src/app");
const server = require("../src/services/salary");

let srv, engine;
before(async () => {
  srv = app.listen(0);
  const { port } = srv.address();
  const res = await fetch(`http://localhost:${port}/salary.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /javascript/);
  const window = {};
  vm.runInNewContext(await res.text(), { window });
  engine = window.SalaryEngine;
});
after(() => srv.close());

const MON = "2026-08-10", SAT = "2026-08-15";

test("המנוע המוגש לדפדפן משתמש בתעריף של מקום העבודה", () => {
  const job = { hourlyRate: 55 };
  assert.equal(engine.computeSalary(MON, "09:00", "17:00", job).salary, 440); // 8×55
});

test("המנוע המוגש זהה למנוע השרת", () => {
  const job = { hourlyRate: 62.5, weekendMode: "ABSOLUTE", weekendValue: 90, overtimeThresholdHours: 7 };
  for (const [d, s, e] of [[MON, "08:00", "18:00"], [SAT, "15:00", "23:00"], [MON, "20:00", "02:00"]]) {
    assert.deepEqual(engine.computeSalary(d, s, e, job), server.computeSalary(d, s, e, job));
  }
});

test("שעות ברירת המחדל מגיעות ממקום העבודה", () => {
  assert.deepEqual(engine.defaults({ defaultStart: "07:30", defaultEnd: "16:00" }), { start: "07:30", end: "16:00" });
});
