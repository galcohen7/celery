# Celery 🥬

**יומן שכר ומעקב הוצאות אישי.** מסמנים ימי עבודה בלוח שנה והשכר מחושב אוטומטית לפי תנאי מקום העבודה; רושמים הוצאות והן מסווגות לבד; מעלים תלוש שכר או דוח עו״ש ו-AI מצליב אותם מול מה שרשמת.

השם — משחק מילים על *salary*.

---

## מה יש באפליקציה

| אזור | מה עושים בו |
|---|---|
| **שכר** | לוח שנה מלא-מסך: לחיצה על יום מסמנת אותו כיום עבודה עם שעות ברירת המחדל, והשכר מחושב מיד. עריכת שעות או סכום ידני לכל יום. טבלה חודשית עם סיכומים. |
| **מקומות עבודה** | כמה מקומות במקביל, לכל אחד תנאי שכר משלו: שעתי או חודשי, תעריף בסיס, שעות נוספות, סוף שבוע וחג — כל אחד באחוז מהבסיס או בסכום קבוע לשעה. |
| **הוצאות** | הזנה בתיאור חופשי, הצעת קטגוריה אוטומטית, פילוח חודשי והשוואה לחודש הקודם. |
| **מסמכים** | העלאת תלוש שכר או דוח עו״ש (PDF/תמונה). Claude מחלץ את הנתונים, והקוד מצליב אותם מול היומן או ההוצאות ומסמן פערים. **המסמך עצמו לא נשמר** — רק המספרים שאישרת. |
| **מיסים** | פרופיל מס (נקודות זיכוי, פנסיה) ומנוע ניכויים לפי נתוני 2026 הרשמיים. |
| **חופשה ומחלה** | יתרות לפי התלוש האחרון, או אומדן צבירה כשאין תלוש. |
| **חשבון** | הרשמה באשף רב-שלבי, התחברות, איפוס סיסמה, סיור מודרך, גיבוי ושחזור לקובץ JSON. |

## טכנולוגיות

- **שרת:** Node.js 20+ · Express (MVC) · Prisma · JWT + bcrypt
- **מסד:** PostgreSQL בענן · SQLite להרצה מקומית
- **לקוח:** קובץ HTML יחיד (`public/index.html`) ללא שלב build, מוגש ע״י השרת
- **AI:** Claude API (`@anthropic-ai/sdk`) לחילוץ נתונים ממסמכים
- **פריסה:** Render (`render.yaml`)

---

## הרצה מקומית

לא צריך להתקין Postgres.

```bash
npm install
npm run setup:local   # פעם אחת: מסד SQLite מקומי + .env עם JWT_SECRET אקראי
npm run dev           # http://localhost:4000
```

מכאן והלאה מספיק `npm run dev`. השרת מגיש גם את הלקוח, אז פותחים את `http://localhost:4000` בדפדפן.

`setup:local` גוזר עותק SQLite של הסכימה אל `prisma/.local/` ומריץ מולו, **בלי לגעת ב-`prisma/schema.prisma`** שנשאר PostgreSQL עבור הענן — כך אין סיכון לדחוף בטעות סכימת פיתוח.

לניתוח מסמכים יש להוסיף ל-`.env` את `ANTHROPIC_API_KEY`. בלעדיו כל השאר עובד, ונתיבי `/api/documents` מחזירים 503 עם הסבר.

> ⚠️ **המסד המקומי (`prisma/.local/dev.db`) לא מגובה בשום מקום** ונפרד לגמרי מהמסד בענן.
> לפני כל פעולה עליו — **⭳ גיבוי לקובץ** מתוך האפליקציה. להעברת נתונים לענן: גיבוי כאן, **⭱ שחזור מקובץ** שם.
> איפוס: מחיקת `prisma/.local/dev.db` והרצה חוזרת של `npm run setup:local` (מוחק הכל).

### משתני סביבה

| משתנה | חובה | תיאור |
|---|---|---|
| `DATABASE_URL` | כן | מחרוזת חיבור ל-Postgres. מקומית `file:./dev.db` (נוצר ע״י `setup:local`). |
| `JWT_SECRET` | כן | מחרוזת אקראית ארוכה לחתימת טוקנים. |
| `ANTHROPIC_API_KEY` | לא | נדרש רק לניתוח תלושים ודוחות עו״ש. |
| `PORT` | לא | ברירת מחדל 4000. |
| `NODE_ENV` | לא | `development` מחזיר את קוד איפוס הסיסמה בתגובה; `production` לא. |

תבנית: `.env.example`. הקובץ `.env` מוחרג מ-git.

## פריסה לענן

מדריך מלא צעד-אחר-צעד: **[DEPLOY.md](DEPLOY.md)**. בקצרה: דוחפים ל-GitHub, וב-Render בוחרים **New → Blueprint** על ה-repo. `render.yaml` מקים שירות ווב ומסד Postgres, ובונה את הטבלאות ב-`prisma db push`. את `ANTHROPIC_API_KEY` מזינים ידנית בלוח הבקרה. כל push ל-`main` פורס מחדש.

שתי מגבלות של התוכנית החינמית ב-Render:
- השירות **נרדם אחרי ~15 דקות** ללא פעילות; הכניסה הבאה לוקחת 30–60 שניות.
- **מסד Postgres החינמי פג אחרי 30 יום.** לשימוש מתמשך — לשדרג, או להשתמש במסד חינמי חיצוני (Neon / Supabase) ולהזין את `DATABASE_URL` שלו.

---

## בדיקות

```bash
npm test
```

בדיקות יחידה (`node --test`) למנוע השכר, מנוע המס, הצלבת עו״ש, הכרעת חודש התלוש ואימות סיסמאות. אין תלות במסד או ברשת.

## מבנה הפרויקט

```
prisma/schema.prisma        מודל הנתונים
public/
  index.html                הלקוח (HTML + JS, ללא build)
  celery-logo.svg
src/
  app.js, server.js         אפליקציית Express ונקודת הכניסה
  config/db.js              מופע Prisma
  middleware/               אימות JWT, העלאת קבצים (בזיכרון בלבד, עד 20MB)
  routes/  controllers/     שכבת ה-API
  services/
    salary.js               מנוע חישוב השכר
    leave.js                יתרות חופשה ומחלה
    expenseCategory.js      סיווג הוצאות לפי מילות מפתח
    reconcile.js            הצלבת עו״ש מול הוצאות (דטרמיניסטי)
    payslipCompare.js       הצלבת תלוש מול היומן (דטרמיניסטי)
    tax/                    מנוע מס + נתוני שיעורים וזכאויות לפי שנה (JSON)
    ai/                     עטיפת Claude API וחילוץ תלוש / עו״ש
scripts/
  local-db.js               הכנת מסד SQLite מקומי (npm run setup:local)
  backfill-jobs.js          מיגרציה: שיוך ימי עבודה ישנים למקום עבודה
  friday-hours.js           מיגרציה חד-פעמית (הוחלה): שעות ימי שישי
test/                       בדיקות
spec.md                     מסמך האפיון המלא
STATUS.md                   מצב הפרויקט ונקודת המשך
DEPLOY.md                   מדריך פריסה
```

**מודלים:** `User`, `Job`, `WorkDay`, `Expense`, `TaxProfile`, `PayslipAnalysis`, `StatementLine`, `PasswordResetToken`. סכומי הוצאות ותלושים נשמרים **באגורות** כמספר שלם, כדי למנוע שגיאות עיגול.

## איך מחושב השכר

`services/salary.js` עובר על המשמרת דקה אחר דקה ומתמחר כל דקה לפי תנאי מקום העבודה:

- **תעריף בסיס** לשעה.
- **סוף שבוע** — חלון זמן שחוצה ימים (יום + שעה התחלה ← יום + שעה סיום).
- **חג** — לימים שסומנו כחג.
- **שעות נוספות** — מכפיל על כל דקה מעבר לסף השעות.
- כל תעריף הוא זוג `mode`+`value`: `PERCENT` (אחוז מהבסיס, ומתעדכן כשהבסיס משתנה) או `ABSOLUTE` (סכום קבוע לשעה).
- משמרת שחוצה חצות מחושבת כרצף אחד.

**כלל נעול:** שכר שנשמר ליום לא מחושב מחדש לעולם — גם לא כשהתעריפים משתנים — כי הוא עשוי להכיל עריכה ידנית (`spec.md` 5.2).

## API

כל הנתיבים מתחת ל-`/api`. חוץ מהרשמה, התחברות ואיפוס סיסמה — כולם דורשים `Authorization: Bearer <token>`. שגיאות מוחזרות כ-`{ "error": "..." }`.

**אימות** — `/api/auth`
| | |
|---|---|
| `POST /register` | `{ name, email, password }` → `{ token, user }`. סיסמה: 6+ תווים, ASCII מודפס בלבד. |
| `POST /login` | `{ email, password }` → `{ token, user }` |
| `GET /me` | המשתמש המחובר |
| `POST /forgot-password` | `{ email }` — בפיתוח מחזיר `devToken` |
| `POST /reset-password` | `{ token, password }` |

**מקומות עבודה** — `/api/jobs`
| | |
|---|---|
| `GET /` | רשימה + `needsOnboarding` כשאין אף מקום |
| `POST /` | יצירה: `{ name, payType, hourlyRate?, monthlySalary?, ... }` |
| `PUT /:id` | עדכון תנאי השכר |
| `POST /:id/activate` | הפיכה למקום הפעיל |
| `DELETE /:id` | מחיקה; מקום עם ימי עבודה **מאורכב** ולא נמחק |
| `POST /preview` | `{ profile }` → דוגמאות שכר בלי לשמור |

**ימי עבודה** — `/api/workdays`
| | |
|---|---|
| `GET /?jobId=` | כל הימים |
| `POST /` | `{ date, start?, end?, salary?, jobId?, isHoliday? }` — יצירה או עדכון. בלי `salary` השרת מחשב. |
| `DELETE /:date?jobId=` | מחיקת יום |

**הוצאות** — `/api/expenses`: `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`, `GET /categories`, `POST /suggest-category`

**מסמכים** — `/api/documents`: `GET /status`, `POST /payslip` (multipart), `POST /payslip/confirm`, `GET /payslips`, `POST /statement` (multipart), `POST /statement/confirm`. נתיבי הניתוח מחזירים **טיוטה** בלבד; שמירה רק ב-`confirm`.

**מס** — `/api/tax`: `GET|PUT /profile`, `POST /calculate`, `GET /rates`, `GET /entitlements`, `POST /suggest-points`

**חופשה** — `GET /api/leave/balance`

דוגמה:

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"secret123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

curl -s -X POST localhost:4000/api/workdays \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"date":"2026-08-07","start":"09:00","end":"17:00"}'
```

---

## פרטיות ואבטחה

- מסמכים שמועלים מנותחים **בזיכרון בלבד** ולא נכתבים לדיסק או למסד.
- סיסמאות נשמרות כ-hash (bcrypt). קודי איפוס נשמרים כ-hash ופגים אחרי 30 דקות.
- כל שאילתה מסוננת לפי המשתמש המחובר.

## מגבלות ידועות

- **שליחת מייל לאיפוס סיסמה לא מחוברת.** בפיתוח הקוד מוחזר בתגובה; בייצור — רק בלוג השרת.
- **מנוע המס מכסה את 2026 בלבד** ולא מחשב את הטבת המס על הפרשה לפנסיה (סעיף 45א). זו בדיקת שפיות, לא ייעוץ מס.
- **הלקוח עדיין מחשב שכר ימים חדשים לפי תעריפים קבועים בקוד** ולא לפי מקום העבודה. בתהליך תיקון, יחד עם הפיכת כל הגדרות השכר והמשמרות להגדרות משתמש.
- הממשק בעברית בלבד, והמס, התלוש וסיווג ההוצאות מותאמים לישראל.

## מסמכים נוספים

- [spec.md](spec.md) — האפיון המלא והחלטות התכנון
- [STATUS.md](STATUS.md) — מה נבנה, מה הבא, ונקודת המשך לסוכן
- [DEPLOY.md](DEPLOY.md) — פריסה ל-Render
