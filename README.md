# Celery — שרת (שלב B: חשבונות ויומן)

שרת Node.js בתבנית MVC: הרשמה, התחברות, איפוס סיסמה, ויומן ימי עבודה עם חישוב שכר בצד השרת. השרת מגיש גם את הלקוח מ-`public/`. מסד נתונים: PostgreSQL דרך Prisma.

## מבנה הפרויקט

```
server/
  prisma/schema.prisma      מודל הנתונים (User, WorkDay, PasswordResetToken)
  src/
    app.js                  הגדרת אפליקציית Express
    server.js               נקודת הכניסה
    config/db.js            מופע Prisma
    middleware/auth.js      אימות טוקן JWT
    controllers/            לוגיקת ה-API (auth, workday)
    routes/                 הגדרת הנתיבים
    services/salary.js      מנוע חישוב השכר
    utils/asyncHandler.js   עטיפת שגיאות אסינכרוניות
```

## הפעלה

**פריסה בענן (הדרך המומלצת):** ראה `DEPLOY.md` — מדריך צעד־צעד ל-Render עם GitHub. השרת מגיש גם את הלקוח, אז נכנסים לכתובת אחת והכל עובד.

**הרצה מקומית:** אין צורך להתקין Postgres. הרצה ראשונה:

```bash
cd server
npm install
npm run setup:local       # מסד SQLite מקומי + .env עם JWT_SECRET אקראי
npm run dev               # http://localhost:4000
```

מכאן והלאה מספיק `npm run dev`. פותחים בדפדפן את `http://localhost:4000` — השרת מגיש את הלקוח.

`setup:local` גוזר עותק SQLite של הסכימה אל `prisma/.local/` ומריץ מולו, **בלי לגעת ב-`prisma/schema.prisma`** שנשאר PostgreSQL עבור הענן. כך אין סיכון לדחוף בטעות סכימת פיתוח ולשבור את הפריסה. התיקייה `prisma/.local/` ו-`.env` מוחרגים ב-`.gitignore`.

### גיבוי הנתונים המקומיים

`prisma/.local/dev.db` הוא קובץ מקומי שמוחרג מ-git — **הוא לא מגובה בשום מקום**, והוא נפרד לחלוטין
מהמסד שבענן. לפני כל פעולה שנוגעת בו, ולפני מעבר לענן, יש לייצא גיבוי מהאפליקציה
(**⭳ גיבוי לקובץ**) ולשחזר אותו בצד השני (**⭱ שחזור מקובץ**). קובץ ה-JSON הוא הנכס הנייד.

לאיפוס המסד המקומי: למחוק את `prisma/.local/dev.db` ולהריץ שוב `npm run setup:local`.
**זה מוחק את כל הנתונים המקומיים לצמיתות** — לגבות קודם.

## נקודות קצה (API)

אימות:
- `POST /api/auth/register` — body: `{ "email", "password" }` → מחזיר `{ token, user }`
- `POST /api/auth/login` — body: `{ "email", "password" }` → מחזיר `{ token, user }`
- `POST /api/auth/forgot-password` — body: `{ "email" }` → בפיתוח מחזיר `{ devToken }`
- `POST /api/auth/reset-password` — body: `{ "token", "password" }`

יומן (דורש כותרת `Authorization: Bearer <token>`):
- `GET /api/workdays` — כל ימי העבודה של המשתמש
- `POST /api/workdays` — body: `{ "date", "start"?, "end"?, "salary"? }` — יוצר/מעדכן; השרת מחשב את השכר לפי החוקים אם לא נשלח ידנית
- `DELETE /api/workdays/:date` — מחיקת יום

## דוגמה מהירה (curl)

```bash
# הרשמה
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"me@example.com","password":"secret123"}'

# הזנת יום (עם הטוקן שהתקבל)
curl -s -X POST http://localhost:4000/api/workdays \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"date":"2026-08-07"}'
```

## מסד הנתונים

הסכימה מוגדרת ל-PostgreSQL. בענן, Render מזריק את `DATABASE_URL` של המסד המנוהל אוטומטית לפי `render.yaml`.

להרצה מקומית ללא Postgres מותקן: לשנות ב-`prisma/schema.prisma` את `provider` ל-`"sqlite"` ואת `DATABASE_URL` ל-`"file:./dev.db"` — **ולא לדחוף את השינוי הזה ל-git**, אחרת הפריסה תישבר.

## הערות

- שליחת מייל לאיפוס סיסמה עדיין לא מחוברת — בפיתוח הטוקן מוחזר בתגובה וגם נרשם ללוג. חיבור שירות מייל יתווסף בהמשך.
- סיסמאות נשמרות כ-hash (bcrypt) בלבד. יש לקבוע `JWT_SECRET` חזק לפני שימוש אמיתי.
- זהו שלב B מתוך מפת הדרכים במסמך האפיון. השלב הבא: חיבור הלקוח הקיים ל-API הזה, ואז בדיקות התלוש והעו״ש.
