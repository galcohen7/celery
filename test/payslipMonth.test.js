// רגרסיה לבאג: תלוש של יולי הושווה מול ימי אוגוסט.
// הסיבה הייתה שהחודש נלקח מהתפריט ולא מהמסמך.
const { test } = require("node:test");
const assert = require("node:assert");
const { compareToJournal } = require("../src/services/payslipCompare");

const day = (date) => ({ date, start: "15:00", end: "23:00", salary: 320 });

// מדמה את הכרעת החודש שבקונטרולר
const MONTH_RE = /^\d{4}-\d{2}$/;
function resolveMonth(extractedMonth, requestedMonth) {
  const e = MONTH_RE.test(String(extractedMonth || "")) ? extractedMonth : null;
  const r = MONTH_RE.test(String(requestedMonth || "")) ? requestedMonth : null;
  return { month: e || r, source: e ? "document" : "manual", mismatch: !!(e && r && e !== r) };
}

test("החודש שבמסמך גובר על הבחירה בתפריט", () => {
  const r = resolveMonth("2026-07", "2026-08");
  assert.equal(r.month, "2026-07");
  assert.equal(r.source, "document");
  assert.equal(r.mismatch, true);
});

test("כשאין חודש במסמך — נופלים לבחירה הידנית", () => {
  const r = resolveMonth(null, "2026-08");
  assert.equal(r.month, "2026-08");
  assert.equal(r.source, "manual");
  assert.equal(r.mismatch, false);
});

test("חודש לא תקין במסמך אינו גובר", () => {
  assert.equal(resolveMonth("יולי 2026", "2026-08").month, "2026-08");
});

test("אין חודש בכלל — אין הצלבה", () => {
  assert.equal(resolveMonth(null, null).month, null);
});

test("התאמה בין השניים אינה מסומנת כאי-התאמה", () => {
  assert.equal(resolveMonth("2026-07", "2026-07").mismatch, false);
});

test("הצלבה מול החודש הנכון נותנת תוצאה שונה מהשגוי", () => {
  const july = [day("2026-07-05"), day("2026-07-06")];      // 640
  const august = [day("2026-08-03")];                       // 320
  const extracted = { grossShekels: 640, deductions: {}, unreadableFields: [] };

  const right = compareToJournal(extracted, july);
  const wrong = compareToJournal(extracted, august);

  assert.equal(right.alerts.filter((a) => a.field === "ברוטו").length, 0, "מול יולי — אין פער");
  assert.equal(wrong.alerts.filter((a) => a.field === "ברוטו").length, 1, "מול אוגוסט — פער שקרי");
});
