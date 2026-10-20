// מיגרציה חד-פעמית: ימי שישי שנרשמו בשעות המשמרת עוברים לשעות התשלום.
//
// רקע: עד לביטול ההארכה, שישי נרשם 15:00–19:00 אבל שולם עד 23:00. מחיקת
// הכלל משאירה את הימים האלה עם שכר שמור נכון (460) ועם טווח שעות שמייצג
// רק חצי ממנו. זה לא פגם קוסמטי — `payslipCompare.summarizeJournal` מחשב
// מחדש את **השעות** מתוך start/end, ולכן כל שישי היה מדווח 4 שעות במקום 8
// בהצלבה מול התלוש.
//
// מה הסקריפט עושה ומה לא:
//   ✔ מעדכן `end` ל-23:00 בימי שישי שההארכה חלה עליהם.
//   ✘ **לא נוגע ב-`salary`.** זה הכלל הנעול של הפרויקט (spec.md 5.2): שכר
//     שמור עשוי להכיל עקיפה ידנית, וחישוב מחדש היה מוחק אותה בשקט.
//
// למה זה בטוח: הכלל הישן פשוט הציב e=23:00 וחישב. רישום מפורש של 23:00
// מייצר בדיוק את אותו חלון תשלום, ולכן השכר השמור נשאר תקף — 15:00–23:00
// נותן 460 בדיוק כמו 15:00–19:00 עם הארכה.
//
// הרצה:  node scripts/friday-hours.js          ← הצגה בלבד, לא כותב
//        node scripts/friday-hours.js --apply  ← מבצע
//
// אידמפוטנטי: הרצה חוזרת לא מוצאת מה לעדכן.

require("dotenv").config();
const prisma = require("../src/config/db");
const { computeSalary } = require("../src/services/salary");

const PAID_UNTIL_MIN = 23 * 60; // שעת התשלום של הכלל שבוטל
const FRIDAY = 5;

const toMin = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
};

// משחזר את תנאי ההארכה הישנה בדיוק: משמרת שחוצה חצות לא הוארכה מעולם,
// כי סיומה המוחלט כבר עבר את 23:00.
function wasExtended(start, end) {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440;
  return PAID_UNTIL_MIN > e;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const fridays = await prisma.workDay.findMany({
    where: { dow: FRIDAY },
    orderBy: { date: "asc" },
  });
  const targets = fridays.filter((d) => wasExtended(d.start, d.end));

  console.log(`ימי שישי במסד: ${fridays.length} · מתוכם לעדכון: ${targets.length}`);
  if (!targets.length) {
    console.log("אין מה לעדכן.");
    return;
  }

  // אימות לפני כתיבה: השכר השמור חייב להישאר תקף מול השעות החדשות.
  // יום שלא מסתדר הוא כמעט תמיד עקיפה ידנית — מדווחים ולא נוגעים בשכר.
  const overrides = [];
  for (const d of targets) {
    const expected = computeSalary(d.date, d.start, "23:00").salary;
    const mark = expected === d.salary ? "✔" : "⚠";
    if (expected !== d.salary) overrides.push({ ...d, expected });
    console.log(`  ${mark} ${d.date}  ${d.start}-${d.end} → ${d.start}-23:00  · שכר ${d.salary} ₪ (ללא שינוי)`);
  }

  if (overrides.length) {
    console.log(
      `\n⚠  ב-${overrides.length} ימים השכר השמור שונה מהחישוב לשעות החדשות.\n` +
        "   סביר שאלה עריכות ידניות. השכר **לא** ישונה — רק השעות."
    );
  }

  if (!apply) {
    console.log("\nהרצה יבשה. להרצה בפועל: node scripts/friday-hours.js --apply");
    return;
  }

  let updated = 0;
  for (const d of targets) {
    await prisma.workDay.update({ where: { id: d.id }, data: { end: "23:00" } });
    updated++;
  }
  console.log(`\nעודכנו ${updated} ימים. סך השכר במסד לא השתנה.`);
}

main()
  .catch((err) => {
    console.error("המיגרציה נכשלה:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
