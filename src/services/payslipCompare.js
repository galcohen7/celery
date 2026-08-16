// הצלבת תלוש מול יומן ימי העבודה — קוד דטרמיניסטי, לא AI (spec.md 7.3).
//
// ה-AI מחזיר מה כתוב בתלוש. כאן אנחנו מחשבים מה *היה אמור* להיות כתוב
// לפי היומן, ומשווים. כך התוצאה ניתנת לשחזור ולא משתנה בין הרצות.
//
// הערה על היקף: השוואת הניכויים (מס הכנסה, ביטוח לאומי, מס בריאות) דורשת
// את מנוע המס ולכן שייכת לשלב C2. כאן מכוסות סעיפים 1 ו-2 של הדוח —
// פרטי התלוש וההצלבה מול היומן.

const { computeSalary } = require("./salary");

// סף הסטייה שמעליו מתריעים. אחוז ולא סכום קבוע, כדי שיתאים גם לחודש
// חלקי וגם למשרה מלאה. 2% מכסה הפרשי עיגול לגיטימיים.
const TOLERANCE_PCT = 2;

const shekelsToAgorot = (s) => (s == null ? null : Math.round(Number(s) * 100));

function summarizeJournal(workdays) {
  let totalAgorot = 0, totalHours = 0;
  for (const d of workdays) {
    totalAgorot += Number(d.salary) * 100; // שכר יומי נשמר בשקלים שלמים
    totalHours += computeSalary(d.date, d.start, d.end).paidH;
  }
  return { days: workdays.length, hours: Math.round(totalHours * 100) / 100, grossAgorot: totalAgorot };
}

function pctDiff(actual, expected) {
  if (!expected) return null;
  return ((actual - expected) / expected) * 100;
}

/**
 * @param {object} extracted תוצאת ה-AI (סכומים בשקלים)
 * @param {Array} workdays ימי העבודה של אותו חודש
 */
function compareToJournal(extracted, workdays) {
  const journal = summarizeJournal(workdays);
  const reportedGross = shekelsToAgorot(extracted.grossShekels);
  const alerts = [];

  // ברוטו
  let grossDiffPct = null;
  if (reportedGross != null && journal.grossAgorot > 0) {
    grossDiffPct = pctDiff(reportedGross, journal.grossAgorot);
    if (Math.abs(grossDiffPct) > TOLERANCE_PCT) {
      alerts.push({
        level: grossDiffPct < 0 ? "חריג" : "לבדיקה",
        field: "ברוטו",
        message: `הברוטו בתלוש ${fmt(reportedGross)} ₪, ולפי היומן ציפינו ל-${fmt(journal.grossAgorot)} ₪ ` +
          `(${grossDiffPct > 0 ? "+" : ""}${grossDiffPct.toFixed(1)}%).`,
      });
    }
  }

  // ימים
  if (extracted.daysReported != null && journal.days > 0 && extracted.daysReported !== journal.days) {
    alerts.push({
      level: "לבדיקה",
      field: "ימים",
      message: `בתלוש ${extracted.daysReported} ימים, ביומן ${journal.days}.`,
    });
  }

  // שעות
  if (extracted.hoursReported != null && journal.hours > 0) {
    const d = Math.abs(extracted.hoursReported - journal.hours);
    if (d > 1) {
      alerts.push({
        level: "לבדיקה",
        field: "שעות",
        message: `בתלוש ${extracted.hoursReported} שעות, ביומן ${journal.hours}.`,
      });
    }
  }

  // שדות שה-AI לא הצליח לקרוא — לא ממצא פיננסי, אבל המשתמש חייב לדעת
  // שההשוואה חלקית ולא להסיק ממנה יותר ממה שיש.
  if (Array.isArray(extracted.unreadableFields) && extracted.unreadableFields.length) {
    alerts.push({
      level: "לבדיקה",
      field: "קריאות",
      message: `שדות שלא נקראו בוודאות מהמסמך: ${extracted.unreadableFields.join(", ")}. כדאי לבדוק ידנית.`,
    });
  }

  if (!workdays.length) {
    alerts.push({
      level: "לבדיקה",
      field: "יומן",
      message: "לא נמצאו ימי עבודה ביומן לחודש הזה, ולכן לא ניתן להצליב את הברוטו.",
    });
  }

  return {
    journal,
    reported: {
      grossAgorot: reportedGross,
      netAgorot: shekelsToAgorot(extracted.netShekels),
      days: extracted.daysReported,
      hours: extracted.hoursReported,
    },
    grossDiffPct,
    alerts,
  };
}

const fmt = (agorot) => (agorot / 100).toLocaleString("he-IL", { maximumFractionDigits: 2 });

module.exports = { compareToJournal, summarizeJournal, TOLERANCE_PCT };
