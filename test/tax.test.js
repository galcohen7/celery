// בדיקות מנוע המס. הרצה: npm test
//
// הערכים הצפויים מחושבים ידנית מהמדרגות הרשמיות, לא מהרצת המנוע עצמו —
// אחרת הבדיקה רק מאשרת את הבאג.
const { test } = require("node:test");
const assert = require("node:assert");
const { computeDeductions, availableYears } = require("../src/services/tax/engine");

const sh = (agorotVal) => agorotVal / 100;
const near = (actual, expected, tol = 1) =>
  assert.ok(Math.abs(actual - expected) <= tol, `צפוי ~${expected}, התקבל ${actual}`);

test("שנה ללא נתונים זורקת שגיאה מפורשת ולא מנחשת", () => {
  assert.throws(() => computeDeductions(10000, {}, 2019), /אין נתוני מס לשנת 2019/);
});

test("2026 קיימת ברשימת השנים", () => {
  assert.ok(availableYears().includes(2026));
});

test("מדרגה ראשונה בלבד: 5,000 ברוטו", () => {
  // 5,000 × 10% = 500 לפני זיכוי. 2.25 נק' × 242 = 544.5 -> המס מתאפס.
  const r = computeDeductions(5000, { creditPoints: 2.25 });
  near(sh(r.taxBeforeCreditsAgorot), 500);
  assert.equal(r.deductions.incomeTaxAgorot, 0, "נקודות זיכוי גדולות מהמס -> אפס, לא שלילי");
});

test("נקודות זיכוי לא יוצרות החזר", () => {
  const r = computeDeductions(3000, { creditPoints: 10 });
  assert.equal(r.deductions.incomeTaxAgorot, 0);
  assert.ok(r.netAgorot < r.grossAgorot, "עדיין מנוכים ביטוח לאומי ובריאות");
});

test("שתי מדרגות: 9,000 ברוטו", () => {
  // 7,010 × 10% = 701 | (9,000-7,010)=1,990 × 14% = 278.6 | סה"כ 979.6
  const r = computeDeductions(9000, { creditPoints: 0 });
  near(sh(r.taxBeforeCreditsAgorot), 979.6);
});

test("שלוש מדרגות: 15,000 ברוטו", () => {
  // 701 + 426.44 (3,050×14%) + 988 (4,940×20%) = 2,115.44
  const r = computeDeductions(15000, { creditPoints: 0 });
  near(sh(r.taxBeforeCreditsAgorot), 2115.44);
});

test("ביטוח לאומי ובריאות מתחלקים נכון סביב המדרגה המופחתת", () => {
  // עד 7,703: 1.04% + 3.23% | מעל: 7% + 5.17%
  const r = computeDeductions(10000, { creditPoints: 0 });
  const reduced = 7703, full = 10000 - 7703;
  near(sh(r.deductions.nationalInsuranceAgorot), reduced * 0.0104 + full * 0.07);
  near(sh(r.deductions.healthInsuranceAgorot), reduced * 0.0323 + full * 0.0517);
});

test("מתחת למדרגה המופחתת — שיעור מופחת בלבד", () => {
  const r = computeDeductions(5000, { creditPoints: 0 });
  near(sh(r.deductions.nationalInsuranceAgorot), 5000 * 0.0104);
  near(sh(r.deductions.healthInsuranceAgorot), 5000 * 0.0323);
});

test("תקרת דמי ביטוח נאכפת ומדווחת", () => {
  const atCap = computeDeductions(51910, { creditPoints: 0 });
  const above = computeDeductions(80000, { creditPoints: 0 });
  assert.equal(
    above.deductions.nationalInsuranceAgorot,
    atCap.deductions.nationalInsuranceAgorot,
    "מעל התקרה אין תוספת ביטוח לאומי"
  );
  assert.ok(above.limitations.some((l) => /תקרת דמי הביטוח/.test(l)));
});

test("מס יסף נכנס מעל 60,130 לחודש", () => {
  const below = computeDeductions(60000, { creditPoints: 0 });
  const above = computeDeductions(61000, { creditPoints: 0 });
  const threshold = 721560 / 12;
  const extra = (61000 - threshold) * 0.03;
  // הפרש המס בין השניים כולל גם 47% על ההפרש וגם את היסף
  near(sh(above.taxBeforeCreditsAgorot) - sh(below.taxBeforeCreditsAgorot), 1000 * 0.47 + extra, 2);
});

test("פנסיה מנוכה ומסומנת כמגבלה", () => {
  const r = computeDeductions(10000, { creditPoints: 2.25, pensionPercent: 6 });
  near(sh(r.deductions.pensionAgorot), 600);
  assert.ok(r.limitations.some((l) => /45א/.test(l)), "חייב להזהיר שהטבת המס לא מחושבת");
});

test("נטו = ברוטו פחות סך הניכויים", () => {
  const r = computeDeductions(12000, { creditPoints: 2.25, pensionPercent: 6 });
  assert.equal(r.netAgorot, r.grossAgorot - r.totalDeductionsAgorot);
});

test("ברוטו אפס מחזיר אפס ולא קורס", () => {
  const r = computeDeductions(0, { creditPoints: 2.25 });
  assert.equal(r.totalDeductionsAgorot, 0);
  assert.equal(r.netAgorot, 0);
});

test("ברוטו שלילי נדחה", () => {
  assert.throws(() => computeDeductions(-100, {}), /ברוטו לא תקין/);
});

test("התוצאה נושאת את מקור הנתונים", () => {
  const r = computeDeductions(10000, {});
  assert.ok(r.ratesMeta.sources.length >= 2);
  assert.match(r.ratesMeta.sources[0].publisher, /רשות המסים/);
});
