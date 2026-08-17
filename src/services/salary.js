// מנוע חישוב השכר.
//
// עד שלב B2 הערכים היו קבועים בקוד. עכשיו הם מגיעים מ-WageProfile, אבל
// **ברירות המחדל מייצרות תוצאה זהה בדיוק** — 40 ₪ בסיס, סופ״ש 150% (=60),
// נוספות 125%, סף 8 שעות, שישי משולם עד 23:00. זו הדרישה שאסור להפר:
// ימים שכבר הוזנו לא משנים את ערכם (spec.md 5.2).
//
// כל תעריף מיוצג כזוג mode+value:
//   PERCENT  → אחוז מתעריף הבסיס. 150 = פי 1.5. שינוי הבסיס מתגלגל אוטומטית.
//   ABSOLUTE → שקלים לשעה, ללא תלות בבסיס.

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const DEFAULT_PROFILE = {
  payType: "HOURLY",
  hourlyRate: 40,
  monthlySalary: null,
  overtimeMode: "PERCENT",
  overtimeValue: 125,
  weekendMode: "PERCENT",
  weekendValue: 150,
  holidayMode: "PERCENT",
  holidayValue: 150,
  overtimeThresholdHours: 8,
  weekendStartDow: 5,
  weekendStartHour: 16,
  weekendEndDow: 0,
  weekendEndHour: 8,
  fridayPaidUntil: "23:00",
};

function withDefaults(profile) {
  return { ...DEFAULT_PROFILE, ...(profile || {}) };
}

// מתרגם זוג mode+value לתעריף שקלי לשעה.
function resolveRate(mode, value, baseRate) {
  return mode === "ABSOLUTE" ? Number(value) : baseRate * (Number(value) / 100);
}

function toMin(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}

function dowOf(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function defaults(dow, profile) {
  const p = withDefaults(profile);
  // ברירת המחדל לשישי נגזרת מהמשמרת בפועל, לא משעת התשלום
  return dow === 5 ? { start: "15:00", end: "19:00" } : { start: "15:00", end: "23:00" };
}

// האם הדקה הזו נופלת בחלון סוף השבוע המוגדר בפרופיל.
// החלון חוצה ימים (שישי אחה״צ → ראשון בבוקר), ולכן ההשוואה היא על
// (יום, שעה) ולא על שעה בלבד.
function isWeekendMinute(baseDow, absMin, p) {
  const dow = (baseDow + Math.floor(absMin / 1440)) % 7;
  const hour = (absMin % 1440) / 60;

  const startDow = p.weekendStartDow, endDow = p.weekendEndDow;
  const afterStart = dow > startDow || (dow === startDow && hour >= p.weekendStartHour);
  const beforeEnd = dow < endDow || (dow === endDow && hour < p.weekendEndHour);

  // אם החלון עוטף את סוף השבוע היומני (שישי → ראשון), התנאי הוא "או"
  return startDow > endDow ? afterStart || beforeEnd : afterStart && beforeEnd;
}

/**
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} start 'HH:MM'
 * @param {string} end 'HH:MM'
 * @param {object} [profile] WageProfile; חסר → ברירות המחדל ההיסטוריות
 * @param {boolean} [isHoliday] יום חג — משתמש בתעריף החג
 */
function computeSalary(dateStr, start, end, profile, isHoliday = false) {
  const p = withDefaults(profile);
  const base = Number(p.hourlyRate);
  const weekendRate = resolveRate(p.weekendMode, p.weekendValue, base);
  const holidayRate = resolveRate(p.holidayMode, p.holidayValue, base);
  const otMultiplier = resolveRate(p.overtimeMode, p.overtimeValue, 100) / 100;

  const baseDow = dowOf(dateStr);
  let s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440; // חוצה חצות
  const actualH = (e - s) / 60;

  // הארכת שישי: משמרת שמסתיימת מוקדם משולמת עד השעה שבפרופיל
  let fridayExtended = false;
  if (baseDow === 5 && p.fridayPaidUntil) {
    const until = toMin(p.fridayPaidUntil);
    if (until > e) {
      e = until;
      fridayExtended = true;
    }
  }

  const otStart = s + p.overtimeThresholdHours * 60;
  let regBase = 0, regWk = 0, otBase = 0, otWk = 0, pay = 0;

  for (let t = s; t < e; t++) {
    const weekend = isHoliday || isWeekendMinute(baseDow, t, p);
    const rate = isHoliday ? holidayRate : weekend ? weekendRate : base;
    const isOT = t >= otStart;
    pay += (rate / 60) * (isOT ? otMultiplier : 1);
    if (isOT) weekend ? otWk++ : otBase++;
    else weekend ? regWk++ : regBase++;
  }

  return {
    salary: Math.round(pay),
    dow: baseDow,
    actualH,
    paidH: (e - s) / 60,
    fridayExtended,
    isHoliday,
    regBaseH: regBase / 60,
    regWkH: regWk / 60,
    otBaseH: otBase / 60,
    otWkH: otWk / 60,
    rates: { base, weekend: weekendRate, holiday: holidayRate, otMultiplier },
  };
}

module.exports = { computeSalary, defaults, dowOf, resolveRate, withDefaults, HEB_DAYS, DEFAULT_PROFILE };
