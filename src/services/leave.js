// יתרות ימי חופשה ומחלה.
//
// היררכיית מקורות, מהאמין לפחות אמין:
//   1. **התלוש** — הרישום של המעסיק עצמו. זה המקור הקובע.
//   2. **הגדרה ידנית** — מה שכתוב בחוזה של המשתמש.
//   3. **המינימום החוקי** — רק כרפרנס, ורק למחלה.
//
// למה אין ברירת מחדל לחופשה: הזכאות תלויה בוותק ובהסכם העבודה, ורוב
// ההסכמים נדיבים מהמינימום החוקי. מספר מנוחש כאן היה גרוע יותר מכלום —
// המשתמש היה מתכנן חופשה על סמך יתרה שגויה.

// חוק דמי מחלה, תשל״ו-1976: צבירה של יום וחצי לכל חודש עבודה מלא,
// עד תקרה של 90 ימים.
const STATUTORY_SICK = {
  perMonth: 1.5,
  cap: 90,
  source: "חוק דמי מחלה, תשל״ו-1976",
  url: "https://www.nevo.co.il/law_html/law00/71572.htm",
};

/**
 * מרכיב תמונת יתרות מהתלוש האחרון שנשמר ומהפרופיל.
 * @param {object|null} latestPayslip רשומת PayslipAnalysis אחרונה
 * @param {object} wageProfile
 * @param {number} monthsWorked מספר חודשים שיש בהם ימי עבודה ביומן
 */
function buildBalances(latestPayslip, wageProfile = {}, monthsWorked = 0) {
  const perMonth = Number(wageProfile.sickAccrualPerMonth ?? STATUTORY_SICK.perMonth);
  const cap = Number(wageProfile.sickAccrualCap ?? STATUTORY_SICK.cap);
  const annualVacation = wageProfile.annualVacationDays ?? null;

  const fromPayslip = {
    vacation: latestPayslip?.vacationBalance ?? null,
    sick: latestPayslip?.sickBalance ?? null,
    month: latestPayslip?.month ?? null,
  };

  // אומדן מחלה לפי צבירה — רק כשאין נתון בתלוש
  const estimatedSick = Math.min(cap, Math.round(monthsWorked * perMonth * 10) / 10);

  const vacation = {
    balance: fromPayslip.vacation,
    source: fromPayslip.vacation != null ? "payslip" : "unknown",
    annualEntitlement: annualVacation,
    note:
      fromPayslip.vacation != null
        ? `לפי התלוש של ${fromPayslip.month}.`
        : annualVacation != null
        ? "לא נמצאה יתרה בתלוש. הזכאות השנתית שהגדרת מוצגת כרפרנס בלבד."
        : "אין נתון. העלה תלוש שמופיעה בו יתרת חופשה, או הגדר זכאות שנתית בהגדרות.",
  };

  const sick = {
    balance: fromPayslip.sick != null ? fromPayslip.sick : estimatedSick,
    source: fromPayslip.sick != null ? "payslip" : monthsWorked > 0 ? "estimate" : "unknown",
    accrualPerMonth: perMonth,
    cap,
    note:
      fromPayslip.sick != null
        ? `לפי התלוש של ${fromPayslip.month}.`
        : monthsWorked > 0
        ? `אומדן לפי ${perMonth} ימים לחודש על ${monthsWorked} חודשי עבודה ביומן. היתרה בפועל עשויה להיות שונה — התלוש קובע.`
        : "אין מספיק נתונים לאומדן.",
    statutory: STATUTORY_SICK,
  };

  return { vacation, sick };
}

module.exports = { buildBalances, STATUTORY_SICK };
