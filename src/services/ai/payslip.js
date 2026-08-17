// חילוץ שדות מתלוש שכר.
//
// גבול התפקידים (spec.md 7.3): **ה-AI מחלץ, הקוד משווה.**
// כאן אנחנו רק מוציאים מספרים מהמסמך. ההצלבה מול היומן ומול מנוע המס
// נעשית בקוד דטרמיניסטי, כדי שהתוצאה תהיה ניתנת לשחזור ולא תשתנה בין הרצות.

const { analyzeDocument } = require("./client");

// nullable מיוצג ב-anyOf ולא ב-type: ["number","null"] — מערכי טיפוסים
// אינם חלק מתת-הקבוצה הנתמכת בפלט מובנה.
const num = { type: "number" };
const nullableNum = { anyOf: [{ type: "number" }, { type: "null" }] };
const nullableInt = { anyOf: [{ type: "integer" }, { type: "null" }] };

const SCHEMA = {
  type: "object",
  properties: {
    month: { type: "string", description: "חודש התלוש בפורמט YYYY-MM" },
    grossShekels: nullableNum,
    netShekels: nullableNum,
    deductions: {
      type: "object",
      properties: {
        incomeTax: nullableNum,
        nationalInsurance: nullableNum,
        healthTax: nullableNum,
        pension: nullableNum,
        other: nullableNum,
      },
      required: ["incomeTax", "nationalInsurance", "healthTax", "pension", "other"],
      additionalProperties: false,
    },
    hoursReported: nullableNum,
    daysReported: nullableInt,
    employerName: { anyOf: [{ type: "string" }, { type: "null" }] },
    vacationBalanceDays: nullableNum,
    sickBalanceDays: nullableNum,
    unreadableFields: {
      type: "array",
      items: { type: "string" },
      description: "שדות שלא ניתן היה לקרוא בוודאות מהמסמך",
    },
  },
  required: [
    "month", "grossShekels", "netShekels", "deductions",
    "hoursReported", "daysReported", "employerName",
    "vacationBalanceDays", "sickBalanceDays", "unreadableFields",
  ],
  additionalProperties: false,
};

const SYSTEM = `אתה מחלץ נתונים מתלושי שכר ישראליים. תפקידך היחיד הוא קריאה מדויקת של המסמך.

כללים:
- החזר את המספרים בדיוק כפי שהם מופיעים בתלוש, בשקלים.
- אל תחשב, אל תסיק ואל תשלים ערכים חסרים. שדה שאינו מופיע בתלוש הוא null.
- שדה שמופיע אך אינו קריא בוודאות — החזר null ורשום את שמו ב-unreadableFields.
- "מס בריאות" ו"ביטוח לאומי" הם שני ניכויים נפרדים בתלוש ישראלי. אל תאחד אותם.
- תחת other אסוף ניכויים שאינם מס הכנסה, ביטוח לאומי, מס בריאות או פנסיה.
- יתרות חופשה ומחלה מופיעות בתלוש ישראלי בשורות כמו "יתרת חופשה", "יתרת מחלה",
  "ימי חופשה לניצול" או "צבירת מחלה". החזר את **היתרה הנותרת**, לא את הניצול החודשי.`;

const INSTRUCTION =
  "חלץ את השדות מתלוש השכר המצורף. אם מדובר בכמה עמודים, התייחס לכולם כתלוש אחד.";

async function extractPayslip(buffer, mimeType) {
  const { data, usage } = await analyzeDocument({
    buffer, mimeType, system: SYSTEM, instruction: INSTRUCTION, schema: SCHEMA,
  });
  return { data, usage };
}

module.exports = { extractPayslip, SCHEMA };
