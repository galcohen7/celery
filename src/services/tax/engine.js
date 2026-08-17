// מנוע מס — פונקציה טהורה: (ברוטו חודשי, פרופיל מס, שנה) → ניכויים צפויים.
//
// שני כללים שקובעים את המבנה (spec.md 7.5):
//
// 1. **הערכים לא בקוד.** הם בקובץ JSON מגורס לפי שנה, עם מקור ותאריך שליפה.
//    שנה שאין לה קובץ מחזירה שגיאה מפורשת ולא ניחוש.
// 2. **אין תלות במסד ובזמן.** כך המנוע ניתן לבדיקה מלאה מול דוגמאות ידועות.
//
// ⚠️ מה המנוע **לא** מדגם, ולמה זה חשוב:
//    הטבת המס על הפרשות עובד לפנסיה (זיכוי לפי סעיף 45א) אינה מחושבת. לעובד
//    שמפריש לפנסיה, מס ההכנסה בפועל יהיה **נמוך** מהתחזית כאן. זו הסיבה
//    ש-`limitations` מוחזר בכל תוצאה — כדי שהממשק יציג את זה ולא ייתן ביטחון
//    מוטעה. הכלי הוא בדיקת שפיות, לא תחליף לרו״ח.

const RATES = { 2026: require("./rates-2026.json") };

const agorot = (shekels) => Math.round(shekels * 100);

function getRates(year) {
  const r = RATES[year];
  if (!r) {
    throw new Error(
      `אין נתוני מס לשנת ${year}. יש להוסיף rates-${year}.json ממקור רשמי לפני חישוב.`
    );
  }
  return r;
}

function availableYears() {
  return Object.keys(RATES).map(Number).sort();
}

// מס הכנסה מדורג. המדרגות שנתיות בחוק — נגזרות לחודשי בחלוקה ב-12.
function computeIncomeTax(monthlyGross, rates) {
  let remaining = monthlyGross;
  let tax = 0;
  let prevBound = 0;

  for (const b of rates.incomeTax.brackets) {
    const monthlyBound = b.upTo == null ? Infinity : b.upTo / 12;
    const bandWidth = monthlyBound - prevBound;
    const taxable = Math.min(remaining, bandWidth);
    if (taxable <= 0) break;
    tax += taxable * b.rate;
    remaining -= taxable;
    prevBound = monthlyBound;
  }

  // מס יסף על החלק שמעל הסף
  const surtaxThreshold = rates.incomeTax.surtax.annualThreshold / 12;
  if (monthlyGross > surtaxThreshold) {
    tax += (monthlyGross - surtaxThreshold) * rates.incomeTax.surtax.rate;
  }
  return tax;
}

// ביטוח לאומי ומס בריאות: שיעור מופחת עד המדרגה, מלא מעליה ועד התקרה.
function computeInsurance(monthlyGross, rates) {
  const ni = rates.nationalInsurance;
  const capped = Math.min(monthlyGross, ni.maxInsurableIncome);
  const reducedPart = Math.min(capped, ni.reducedBandCeiling);
  const fullPart = Math.max(0, capped - ni.reducedBandCeiling);

  const e = ni.employee;
  return {
    nationalInsurance:
      reducedPart * e.nationalInsurance.reduced + fullPart * e.nationalInsurance.full,
    healthInsurance:
      reducedPart * e.healthInsurance.reduced + fullPart * e.healthInsurance.full,
    cappedAt: monthlyGross > ni.maxInsurableIncome ? ni.maxInsurableIncome : null,
  };
}

/**
 * @param {number} monthlyGrossShekels ברוטו חודשי בשקלים
 * @param {{creditPoints?:number, pensionPercent?:number}} profile
 * @param {number} year שנת מס
 */
function computeDeductions(monthlyGrossShekels, profile = {}, year = 2026) {
  const rates = getRates(year);
  const gross = Number(monthlyGrossShekels);
  if (!Number.isFinite(gross) || gross < 0) throw new Error("ברוטו לא תקין");

  const creditPoints = Number(profile.creditPoints ?? 2.25);
  const pensionPercent = Number(profile.pensionPercent ?? 0);

  const taxBeforeCredits = computeIncomeTax(gross, rates);
  const creditValue = creditPoints * rates.creditPoint.monthlyValue;
  // נקודות זיכוי מקטינות את המס עד אפס בלבד — אין החזר על העודף.
  const incomeTax = Math.max(0, taxBeforeCredits - creditValue);

  const ins = computeInsurance(gross, rates);
  const pension = gross * (pensionPercent / 100);

  const totalDeductions = incomeTax + ins.nationalInsurance + ins.healthInsurance + pension;

  const limitations = [];
  if (pensionPercent > 0) {
    limitations.push(
      "הטבת המס על הפרשה לפנסיה (סעיף 45א) אינה מחושבת. מס ההכנסה בפועל צפוי להיות נמוך מהתחזית."
    );
  }
  if (creditPoints === 2.25 && profile.creditPoints == null) {
    limitations.push("לא הוגדרו נקודות זיכוי; החישוב מניח 2.25 — ברירת המחדל לתושב ישראל.");
  }
  if (ins.cappedAt) {
    limitations.push(`הברוטו חורג מתקרת דמי הביטוח (${ins.cappedAt.toLocaleString("he-IL")} ₪); החישוב מוגבל לתקרה.`);
  }

  return {
    year,
    grossAgorot: agorot(gross),
    creditPoints,
    creditValueAgorot: agorot(creditValue),
    taxBeforeCreditsAgorot: agorot(taxBeforeCredits),
    deductions: {
      incomeTaxAgorot: agorot(incomeTax),
      nationalInsuranceAgorot: agorot(ins.nationalInsurance),
      healthInsuranceAgorot: agorot(ins.healthInsurance),
      pensionAgorot: agorot(pension),
    },
    totalDeductionsAgorot: agorot(totalDeductions),
    netAgorot: agorot(gross - totalDeductions),
    limitations,
    ratesMeta: rates._meta,
  };
}

module.exports = { computeDeductions, availableYears, getRates };
