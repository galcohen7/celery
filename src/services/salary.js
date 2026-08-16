// מנוע חישוב השכר — זהה ללוגיקה שאומתה בלקוח.
// בסיס 40 ₪; סופ"ש 60 ₪ בחלון שישי 16:00 → ראשון 08:00;
// שעות נוספות מעל 8 ש' ביום ×1.25 על התעריף שחל; שישי משולם עד 23:00.

const BASE_RATE = 40;
const WEEKEND_RATE = 60;
const OT_MULT = 1.25;
const OT_THRESHOLD_H = 8;

const HEB_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function dowOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function defaults(dow) {
  return dow === 5 ? { start: "15:00", end: "19:00" } : { start: "15:00", end: "23:00" };
}

function rateAt(baseDow, absMin) {
  const dow = (baseDow + Math.floor(absMin / 1440)) % 7;
  const mid = absMin % 1440;
  const weekend = (dow === 5 && mid >= 16 * 60) || dow === 6 || (dow === 0 && mid < 8 * 60);
  return weekend ? WEEKEND_RATE : BASE_RATE;
}

function computeSalary(dateStr, start, end) {
  const baseDow = dowOf(dateStr);
  let s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440; // חוצה חצות
  const actualH = (e - s) / 60;

  let fridayExtended = false;
  if (baseDow === 5 && 23 * 60 > e) {
    e = 23 * 60; // שישי: משולם כאילו עד 23:00
    fridayExtended = true;
  }

  const otStart = s + OT_THRESHOLD_H * 60;
  let regBase = 0, regWk = 0, otBase = 0, otWk = 0, pay = 0;

  for (let t = s; t < e; t++) {
    const rate = rateAt(baseDow, t);
    const isOT = t >= otStart;
    pay += (rate / 60) * (isOT ? OT_MULT : 1);
    if (isOT) rate === WEEKEND_RATE ? otWk++ : otBase++;
    else rate === WEEKEND_RATE ? regWk++ : regBase++;
  }

  return {
    salary: Math.round(pay),
    dow: baseDow,
    actualH,
    paidH: (e - s) / 60,
    fridayExtended,
    regBaseH: regBase / 60,
    regWkH: regWk / 60,
    otBaseH: otBase / 60,
    otWkH: otWk / 60,
  };
}

module.exports = { computeSalary, defaults, dowOf, HEB_DAYS };
