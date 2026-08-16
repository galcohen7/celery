// חילוץ שורות מדוח עו״ש.
//
// גם כאן ה-AI רק מחלץ. ההתאמה מול ההוצאות נעשית ב-services/reconcile.js
// בקוד דטרמיניסטי — רוב השורות נסגרות בכללי סכום ותאריך בלי AI כלל
// (spec.md 7.4).

const { analyzeDocument } = require("./client");

const SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "תאריך החיוב בפורמט YYYY-MM-DD" },
          amountShekels: { type: "number", description: "סכום החיוב בשקלים, חיובי" },
          merchantRaw: { type: "string", description: "תיאור בית העסק כפי שמופיע בדוח" },
        },
        required: ["date", "amountShekels", "merchantRaw"],
        additionalProperties: false,
      },
    },
    unreadableRowCount: {
      type: "integer",
      description: "מספר שורות שזוהו בדוח אך לא ניתן היה לקרוא בוודאות",
    },
  },
  required: ["lines", "unreadableRowCount"],
  additionalProperties: false,
};

const SYSTEM = `אתה מחלץ שורות חיוב מדוחות עובר ושב ומדוחות כרטיס אשראי ישראליים.

כללים:
- החזר **רק חיובים** (כסף שיצא). התעלם מזיכויים, הפקדות והעברות נכנסות.
- הסכום תמיד חיובי, בשקלים, כולל אגורות.
- merchantRaw הוא הטקסט כפי שמופיע בדוח. אל תנקה, אל תתרגם ואל תפרש אותו.
- תאריכים בדוח ישראלי הם יום/חודש/שנה. המר ל-YYYY-MM-DD.
- שורה שאינה קריאה בוודאות — אל תנחש. אל תכלול אותה וספור אותה ב-unreadableRowCount.
- עסקה בתשלומים היא שורה אחת בסכום שחויב בפועל החודש.`;

const INSTRUCTION = "חלץ את כל שורות החיוב מהדוח המצורף.";

async function extractStatement(buffer, mimeType) {
  const { data, usage } = await analyzeDocument({
    buffer, mimeType, system: SYSTEM, instruction: INSTRUCTION, schema: SCHEMA,
  });
  return { data, usage };
}

module.exports = { extractStatement, SCHEMA };
