// בדיקות למנוע ההצלבה. הרצה: node --test test/
const { test } = require("node:test");
const assert = require("node:assert");
const { reconcile, findRecurring, MATCHED, REVIEW, ANOMALY } = require("../src/services/reconcile");

const line = (date, agorot, merchant) => ({ date, amountAgorot: agorot, merchantRaw: merchant });
const exp = (id, date, agorot, desc) => ({ id, date, amountAgorot: agorot, description: desc });

test("התאמה מדויקת באותו יום", () => {
  const r = reconcile([line("2026-08-10", 4290, "שופרסל")], [exp(1, "2026-08-10", 4290, "סופר")]);
  assert.equal(r.results[0].status, MATCHED);
  assert.equal(r.results[0].matchedExpenseId, 1);
  assert.equal(r.results[0].confidence, 1);
});

test("התאמה בתוך חלון של 3 ימים", () => {
  const r = reconcile([line("2026-08-13", 4290, "שופרסל")], [exp(1, "2026-08-10", 4290, "סופר")]);
  assert.equal(r.results[0].status, MATCHED);
  assert.ok(r.results[0].confidence < 1);
});

test("מעבר לחלון — לא מתאים", () => {
  const r = reconcile([line("2026-08-15", 4290, "שופרסל")], [exp(1, "2026-08-10", 4290, "סופר")]);
  assert.equal(r.results[0].status, REVIEW);
  assert.equal(r.results[0].matchedExpenseId, null);
});

test("סכום שונה באגורה אחת — לא מתאים", () => {
  const r = reconcile([line("2026-08-10", 4291, "שופרסל")], [exp(1, "2026-08-10", 4290, "סופר")]);
  assert.equal(r.results[0].status, REVIEW);
});

test("הוצאה משמשת פעם אחת בלבד", () => {
  const r = reconcile(
    [line("2026-08-10", 4290, "שופרסל"), line("2026-08-11", 4290, "רמי לוי")],
    [exp(1, "2026-08-10", 4290, "סופר")]
  );
  assert.equal(r.results[0].status, MATCHED);
  assert.equal(r.results[1].status, REVIEW);
});

test("ההתאמה הקרובה ביותר בתאריך מנצחת", () => {
  const r = reconcile(
    [line("2026-08-10", 4290, "שופרסל")],
    [exp(1, "2026-08-08", 4290, "רחוק"), exp(2, "2026-08-10", 4290, "קרוב")]
  );
  assert.equal(r.results[0].matchedExpenseId, 2);
});

test("חיוב כפול מסומן כחריג — והראשון נשאר תקין", () => {
  const r = reconcile(
    [line("2026-08-10", 9900, "נטפליקס"), line("2026-08-10", 9900, "נטפליקס")],
    []
  );
  assert.equal(r.results[0].status, REVIEW);
  assert.equal(r.results[1].status, ANOMALY);
  assert.match(r.results[1].alertReason, /כפול/);
});

test("אותו סכום בבתי עסק שונים אינו כפילות", () => {
  const r = reconcile(
    [line("2026-08-10", 5000, "שופרסל"), line("2026-08-10", 5000, "רמי לוי")],
    []
  );
  assert.equal(r.results[1].status, REVIEW);
});

test("הוצאה שנרשמה ולא הופיעה בדוח מדווחת בנפרד", () => {
  const r = reconcile([], [exp(1, "2026-08-10", 4290, "סופר")]);
  assert.equal(r.unmatchedExpenses.length, 1);
  assert.equal(r.summary.unmatchedExpenses, 1);
});

test("סיכום סופר נכון", () => {
  const r = reconcile(
    [line("2026-08-10", 100, "א"), line("2026-08-10", 200, "ב")],
    [exp(1, "2026-08-10", 100, "א")]
  );
  assert.deepEqual(r.summary, { total: 2, matched: 1, review: 1, anomaly: 0, unmatchedExpenses: 0 });
});

test("זיהוי מנוי חוזר משלושה חודשים", () => {
  const rec = findRecurring([
    line("2026-06-01", 9900, "נטפליקס"),
    line("2026-07-01", 9900, "נטפליקס"),
    line("2026-08-01", 9900, "נטפליקס"),
  ]);
  assert.equal(rec.length, 1);
  assert.equal(rec[0].monthCount, 3);
});

test("שני חודשים בלבד אינם מנוי", () => {
  const rec = findRecurring([
    line("2026-07-01", 9900, "נטפליקס"),
    line("2026-08-01", 9900, "נטפליקס"),
  ]);
  assert.equal(rec.length, 0);
});

test("חוצה גבול שנה בחלון התאריכים", () => {
  const r = reconcile([line("2027-01-01", 5000, "א")], [exp(1, "2026-12-31", 5000, "א")]);
  assert.equal(r.results[0].status, MATCHED);
});
