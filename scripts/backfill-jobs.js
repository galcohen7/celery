// מיגרציה: משיוך יחיד למספר מקומות עבודה.
//
// כל משתמש שיש לו ימי עבודה ללא jobId מקבל מקום עבודה ברירת מחדל,
// וכל הימים שלו משויכים אליו. הסקריפט **אידמפוטנטי** — הרצה חוזרת
// לא יוצרת כפילויות ולא נוגעת בימים שכבר משויכים.
//
// אין כאן חישוב מחדש של שכר. הערך השמור נשאר כפי שהוא, כי הוא עשוי
// להכיל עריכה ידנית (spec.md 5.2).

require("dotenv").config();
const prisma = require("../src/config/db");

async function main() {
  const orphans = await prisma.workDay.findMany({ where: { jobId: null } });
  if (!orphans.length) {
    console.log("אין ימי עבודה ללא שיוך. אין מה לעשות.");
    return;
  }

  const byUser = new Map();
  for (const d of orphans) {
    if (!byUser.has(d.userId)) byUser.set(d.userId, []);
    byUser.get(d.userId).push(d);
  }

  for (const [userId, days] of byUser) {
    // מקום עבודה פעיל קיים, אחרת יוצרים אחד
    let job = await prisma.job.findFirst({ where: { userId, archivedAt: null } });
    if (!job) {
      job = await prisma.job.create({
        data: { userId, name: "מקום העבודה שלי", isActive: true },
      });
      console.log(`משתמש ${userId}: נוצר מקום עבודה #${job.id}`);
    }

    const before = days.reduce((s, d) => s + d.salary, 0);
    const { count } = await prisma.workDay.updateMany({
      where: { userId, jobId: null },
      data: { jobId: job.id },
    });
    const after = (
      await prisma.workDay.findMany({ where: { userId, jobId: job.id } })
    ).reduce((s, d) => s + d.salary, 0);

    console.log(`משתמש ${userId}: ${count} ימים שויכו למקום #${job.id}`);
    console.log(`  סכום לפני: ${before} ₪ | סכום אחרי: ${after} ₪`);
    if (after < before) throw new Error("אבדו נתונים במיגרציה — עצירה");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("המיגרציה נכשלה:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
