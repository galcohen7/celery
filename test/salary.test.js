// בדיקות מנוע השכר.
//
// הבדיקה הראשונה היא החשובה: ברירות המחדל חייבות להחזיר **בדיוק** את
// הערכים שהמנוע הישן החזיר, אחרת 33 ימי העבודה הקיימים משנים ערך.
const { test } = require("node:test");
const assert = require("node:assert");
const { computeSalary, resolveRate } = require("../src/services/salary");

// תאריכים ידועים: 10.8.2026 שני, 14.8 שישי, 15.8 שבת
const MON = "2026-08-10", FRI = "2026-08-14", SAT = "2026-08-15";

test("רגרסיה: ברירות מחדל מחזירות את ערכי גרסה 1.0", () => {
  assert.equal(computeSalary(MON, "15:00", "23:00").salary, 320, "א'-ה' חייב להישאר 320");
  // שישי נרשם מאז ביטול ההארכה בשעות התשלום עצמן, והתוצאה זהה: 460
  assert.equal(computeSalary(FRI, "15:00", "23:00").salary, 460, "שישי חייב להישאר 460");
  assert.equal(computeSalary(SAT, "15:00", "23:00").salary, 480, "שבת חייב להישאר 480");
});

test("רגרסיה: שבת 07:00-16:00 נשאר 555", () => {
  // המקרה האמיתי מהיומן: 8 שעות סופ״ש + שעה נוספת
  assert.equal(computeSalary("2026-07-18", "07:00", "16:00").salary, 555);
});

test("רגרסיה: משמרת מקוצרת ביום חול", () => {
  assert.equal(computeSalary("2026-08-06", "15:00", "19:00").salary, 160);
});

test("שישי 15:00-23:00 שקול בדיוק להארכה שבוטלה", () => {
  // הכלל הישן שילם על משמרת 15:00-19:00 כאילו נמשכה עד 23:00 → 460.
  // עכשיו אותן שעות נרשמות במפורש, והתוצאה חייבת להיות זהה.
  const r = computeSalary(FRI, "15:00", "23:00");
  assert.equal(r.salary, 460);       // שעה × 40 + שבע שעות × 60
  assert.equal(r.actualH, 8);
  assert.equal(r.paidH, 8);
});

test("אין יותר הארכת שישי: משולם רק על הזמן הרשום", () => {
  // אותה משמרת בזמנים הישנים משלמת עכשיו את מה שנרשם בלבד.
  const r = computeSalary(FRI, "15:00", "19:00");
  assert.equal(r.salary, 220);       // שעה × 40 + שלוש שעות × 60
  assert.equal(r.actualH, 4);
  assert.equal(r.paidH, 4, "paidH חייב להיות זהה ל-actualH — אין יותר שעות שלא נעבדו");
  assert.equal(r.fridayExtended, undefined, "השדה הוסר מהפלט");
});

test("שישי מתנהג ככל יום אחר בחלון סוף השבוע", () => {
  // אותה משמרת בדיוק בשבת ובשישי חולקת את אותו חלון סופ״ש מ-16:00,
  // ולכן ההבדל היחיד נובע מהחלון — לא מכלל ייעודי לשישי.
  assert.equal(computeSalary(FRI, "16:00", "23:00").salary, 420); // 7×60
  assert.equal(computeSalary(SAT, "16:00", "23:00").salary, 420);
});

test("תעריף בסיס מותאם מגלגל את סופ״ש במצב אחוזים", () => {
  // 50 ₪ בסיס, סופ״ש 150% → 75 ₪
  const p = { hourlyRate: 50 };
  assert.equal(computeSalary(MON, "15:00", "23:00", p).salary, 400); // 8×50
  assert.equal(computeSalary(SAT, "15:00", "23:00", p).salary, 600); // 8×75
});

test("תעריף סופ״ש מוחלט מנתק מהבסיס", () => {
  const p = { hourlyRate: 50, weekendMode: "ABSOLUTE", weekendValue: 60 };
  assert.equal(computeSalary(SAT, "15:00", "23:00", p).salary, 480); // 8×60, לא 8×75
});

test("שינוי מכפיל שעות נוספות", () => {
  // 10 שעות ביום חול: 8 רגילות + 2 נוספות
  const base = computeSalary(MON, "13:00", "23:00");             // 8×40 + 2×50 = 420
  const rich = computeSalary(MON, "13:00", "23:00", { overtimeValue: 200 }); // 8×40 + 2×80 = 480
  assert.equal(base.salary, 420);
  assert.equal(rich.salary, 480);
});

test("שינוי סף השעות הנוספות", () => {
  // סף 6 שעות: 6×40 + 2×50 = 340
  assert.equal(computeSalary(MON, "15:00", "23:00", { overtimeThresholdHours: 6 }).salary, 340);
});

test("תעריף חג נפרד מתעריף סופ״ש", () => {
  const p = { holidayMode: "PERCENT", holidayValue: 200 };
  // יום שני שסומן כחג: 8 שעות × 80
  assert.equal(computeSalary(MON, "15:00", "23:00", p, true).salary, 640);
});

test("חג גובר גם על יום חול רגיל", () => {
  const normal = computeSalary(MON, "15:00", "23:00");
  const holiday = computeSalary(MON, "15:00", "23:00", {}, true);
  assert.ok(holiday.salary > normal.salary);
  assert.equal(holiday.isHoliday, true);
});

test("חלון סופ״ש מותאם משנה את נקודת המעבר", () => {
  // הזזת תחילת סופ״ש ל-14:00 → כל המשמרת בתעריף סופ״ש
  const r = computeSalary(FRI, "15:00", "19:00", { weekendStartHour: 14 });
  assert.equal(r.salary, 240); // 4×60
  assert.equal(r.regBaseH, 0);
});

test("resolveRate: אחוזים מול מוחלט", () => {
  assert.equal(resolveRate("PERCENT", 150, 40), 60);
  assert.equal(resolveRate("ABSOLUTE", 60, 40), 60);
  assert.equal(resolveRate("PERCENT", 100, 40), 40);
});

test("משמרת שחוצה חצות מחושבת נכון", () => {
  const r = computeSalary(MON, "20:00", "02:00");
  assert.equal(r.actualH, 6);
  assert.equal(r.salary, 240); // 6×40, מתחת לסף הנוספות
});
