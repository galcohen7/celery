// הצלבת שורות עו״ש מול הוצאות שנרשמו ידנית — שלב דטרמיניסטי.
//
// למה קודם כללים ורק אחר כך AI (spec.md 7.4): רוב השורות מתאימות בהתאמת
// סכום ותאריך. להעביר את כולן למודל היה יקר, איטי, ולא ניתן לשחזור.
// ה-AI שמור לשארית — שמות מקוצרים, פיצולים, עסקאות בתשלומים.
//
// פונקציה טהורה בכוונה: אין גישה למסד ואין תלות בזמן, כדי שתהיה
// ניתנת לבדיקה מלאה.

const DAY_MS = 24 * 60 * 60 * 1000;

const MATCHED = "MATCHED";
const REVIEW = "REVIEW";
const ANOMALY = "ANOMALY";

// חלון ההתאמה: חיוב מופיע בעו״ש לרוב יום-יומיים אחרי הקנייה בפועל,
// ולפעמים לפני, כשהתאריך שנרשם ידנית הוא של החשבונית.
const DATE_WINDOW_DAYS = 3;

function toTime(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function daysApart(a, b) {
  return Math.abs(toTime(a) - toTime(b)) / DAY_MS;
}

/**
 * @param {Array<{id?:number,date:string,amountAgorot:number,merchantRaw:string}>} lines שורות עו״ש
 * @param {Array<{id:number,date:string,amountAgorot:number,description:string,merchant?:string}>} expenses
 * @returns {{results:Array, unmatchedExpenses:Array, summary:object}}
 */
function reconcile(lines, expenses) {
  const usedExpenseIds = new Set();

  // מועמדים לכל שורה: סכום זהה בדיוק + תאריך בתוך החלון.
  // ממוינים לפי קרבת תאריך, כדי שהתאמה טובה תיבחר לפני חלשה.
  const results = lines.map((line) => {
    const candidates = expenses
      .filter((e) => !usedExpenseIds.has(e.id) && e.amountAgorot === line.amountAgorot)
      .map((e) => ({ e, dist: daysApart(e.date, line.date) }))
      .filter((c) => c.dist <= DATE_WINDOW_DAYS)
      .sort((a, b) => a.dist - b.dist);

    if (candidates.length) {
      const best = candidates[0];
      usedExpenseIds.add(best.e.id);
      return {
        line,
        status: MATCHED,
        matchedExpenseId: best.e.id,
        // ודאות מלאה רק בהתאמה באותו יום; ככל שהפער גדל היא יורדת.
        confidence: best.dist === 0 ? 1 : 0.9 - best.dist * 0.1,
        alertReason: null,
      };
    }

    return {
      line,
      status: REVIEW,
      matchedExpenseId: null,
      confidence: null,
      alertReason: "חיוב שלא נמצאה לו הוצאה תואמת",
    };
  });

  markDuplicates(results);

  // הוצאות שנרשמו ידנית ולא הופיעו בדוח. אות אחר לגמרי מהמקרה ההפוך:
  // בדרך כלל טעות הקלדה או חיוב שטרם נכנס, לא הוצאה נסתרת.
  const unmatchedExpenses = expenses.filter((e) => !usedExpenseIds.has(e.id));

  return {
    results,
    unmatchedExpenses,
    summary: {
      total: results.length,
      matched: results.filter((r) => r.status === MATCHED).length,
      review: results.filter((r) => r.status === REVIEW).length,
      anomaly: results.filter((r) => r.status === ANOMALY).length,
      unmatchedExpenses: unmatchedExpenses.length,
    },
  };
}

// חיוב כפול: אותו בית עסק, אותו סכום, בתוך יומיים. מסמן את המופע השני
// ואילך, לא את הראשון — ההנחה היא שהראשון תקין.
function markDuplicates(results) {
  const seen = new Map();
  for (const r of results) {
    const key = normalizeMerchant(r.line.merchantRaw) + "|" + r.line.amountAgorot;
    const prev = seen.get(key);
    if (prev && daysApart(prev.line.date, r.line.date) <= 2) {
      r.status = ANOMALY;
      r.alertReason = "חיוב כפול אפשרי — אותו בית עסק ואותו סכום";
    } else {
      seen.set(key, r);
    }
  }
}

function normalizeMerchant(s) {
  return String(s || "").toLowerCase().replace(/["'׳״]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * מזהה מנויים והוראות קבע: אותו בית עסק ואותו סכום שחוזרים
 * לפחות שלושה חודשים שונים. משמש להתראה על מנוי שנשכח.
 */
function findRecurring(lines) {
  const groups = new Map();
  for (const l of lines) {
    const key = normalizeMerchant(l.merchantRaw) + "|" + l.amountAgorot;
    if (!groups.has(key)) groups.set(key, { merchantRaw: l.merchantRaw, amountAgorot: l.amountAgorot, months: new Set() });
    groups.get(key).months.add(String(l.date).slice(0, 7));
  }
  return [...groups.values()]
    .filter((g) => g.months.size >= 3)
    .map((g) => ({ merchantRaw: g.merchantRaw, amountAgorot: g.amountAgorot, monthCount: g.months.size }));
}

module.exports = { reconcile, findRecurring, MATCHED, REVIEW, ANOMALY, DATE_WINDOW_DAYS };
