// מכין מסד SQLite מקומי לפיתוח, בלי לגעת ב-prisma/schema.prisma.
//
// למה: הסכימה הראשית מוגדרת ל-PostgreSQL כי זה מה שרץ בענן, ושינוי שלה
// לפיתוח מקומי מסתיים בדחיפה בטעות ובפריסה שבורה. במקום זה, הסקריפט גוזר
// עותק sqlite זמני ל-prisma/.local/ (מוחרג ב-.gitignore) ומריץ מולו.
// מקור אמת אחד — schema.prisma — ואפס סיכון לדליפה לענן.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const serverDir = path.join(__dirname, "..");
const source = path.join(serverDir, "prisma", "schema.prisma");
const localDir = path.join(serverDir, "prisma", ".local");
const target = path.join(localDir, "schema.prisma");

const schema = fs.readFileSync(source, "utf8");
if (!schema.includes('provider = "postgresql"')) {
  console.error(
    'שגיאה: prisma/schema.prisma כבר לא מוגדר ל-postgresql.\n' +
    'כנראה שונה ידנית לפיתוח מקומי — יש להחזיר אותו ל-"postgresql" לפני דחיפה לענן.'
  );
  process.exit(1);
}

fs.mkdirSync(localDir, { recursive: true });
fs.writeFileSync(target, schema.replace('provider = "postgresql"', 'provider = "sqlite"'));

// הנתיב יחסי לתיקיית הסכימה, כלומר prisma/.local/dev.db
const env = { ...process.env, DATABASE_URL: "file:./dev.db" };

// מריצים את ה-CLI של prisma ישירות דרך node. קריאה ל-npx.cmd דרך execFileSync
// נכשלת ב-EINVAL ב-Node 20+ בוינדוס, ו-shell:true היה דורש ציטוט ידני של נתיבים.
const prismaCli = require.resolve("prisma/build/index.js");
const run = (args) =>
  execFileSync(process.execPath, [prismaCli, ...args], {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });

run(["db", "push", `--schema=${target}`, "--skip-generate"]);

// generate מחליף את ה-DLL של מנוע Prisma. אם שרת פיתוח רץ הוא מחזיק את
// הקובץ ווינדוס מחזיר EPERM — שגיאה שנראית מסתורית אבל הסיבה שלה פשוטה.
try {
  run(["generate", `--schema=${target}`]);
} catch (err) {
  const msg = String(err.stderr || err.message || "");
  if (/EPERM|EBUSY/i.test(msg) || err.status) {
    console.error(
      "\n──────────────────────────────────────────────\n" +
        "יצירת ה-Prisma client נכשלה כי קובץ המנוע נעול.\n" +
        "כמעט תמיד הסיבה: שרת פיתוח רץ ברקע ומחזיק אותו.\n\n" +
        "עצור אותו (Ctrl+C בטרמינל שלו, או Get-Process node | Stop-Process -Force),\n" +
        "הרץ שוב `npm run setup:local`, ואז `npm run dev`.\n" +
        "──────────────────────────────────────────────\n"
    );
    process.exit(1);
  }
  throw err;
}

// .env לפיתוח מקומי — נוצר פעם אחת עם סוד אקראי. מוחרג ב-.gitignore.
const envFile = path.join(serverDir, ".env");
if (!fs.existsSync(envFile)) {
  const secret = require("crypto").randomBytes(48).toString("hex");
  fs.writeFileSync(
    envFile,
    `# נוצר אוטומטית ע"י scripts/local-db.js לפיתוח מקומי בלבד.\n` +
      // נתיב sqlite יחסי נפתר מול תיקיית הסכימה (prisma/.local), לא מול שורש הפרויקט
      `DATABASE_URL="file:./dev.db"\n` +
      `JWT_SECRET="${secret}"\n` +
      `PORT=4000\n` +
      `NODE_ENV="development"\n`
  );
  console.log("נוצר .env לפיתוח מקומי (עם JWT_SECRET אקראי).");
}

console.log("\nמסד מקומי מוכן: prisma/.local/dev.db");
console.log("כעת: npm run dev\n");
