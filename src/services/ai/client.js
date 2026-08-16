// עטיפה יחידה סביב Claude API. כל קריאה ל-AI בפרויקט עוברת דרך כאן.
//
// למה קובץ אחד: המפתח, בחירת המודל, טיפול בסירוב ואכיפת הפלט המובנה
// צריכים להיות במקום אחד. פיזור שלהם על פני קונטרולרים היה מבטיח שאחד
// מהם יישכח — וסירוב שלא נבדק מתבטא בקריסה על content[0].

const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-opus-5";
// מרווח נדיב: ב-Opus 5 החשיבה פעילה כברירת מחדל ונספרת בתוך max_tokens.
// תקרה צרה הייתה חותכת את התשובה באמצע.
const MAX_TOKENS = 16000;

class AiUnavailableError extends Error {}
class AiRefusedError extends Error {}

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiUnavailableError(
      "שירות ה-AI אינו מוגדר. יש להגדיר ANTHROPIC_API_KEY בסביבת השרת."
    );
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// בונה בלוק תוכן ממסמך שהועלה. PDF ותמונה הם טיפוסי בלוק שונים.
// ה-Buffer מגיע מהזיכרון בלבד ולעולם לא נכתב לדיסק (ראה spec.md סעיף 4).
function documentBlock(buffer, mimeType) {
  const data = buffer.toString("base64");
  if (mimeType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  return { type: "image", source: { type: "base64", media_type: mimeType, data } };
}

/**
 * שולח מסמך לניתוח ומחזיר אובייקט מובנה לפי סכימה.
 * הסכימה נאכפת בצד ה-API, כך שאין צורך ב-parsing שביר בצד שלנו.
 */
async function analyzeDocument({ buffer, mimeType, system, instruction, schema }) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [
      { role: "user", content: [documentBlock(buffer, mimeType), { type: "text", text: instruction }] },
    ],
    output_config: { format: { type: "json_schema", schema } },
  });

  // חובה לפני קריאת content: סירוב מחזיר 200 עם content ריק או חלקי.
  if (response.stop_reason === "refusal") {
    throw new AiRefusedError("הבקשה נדחתה על ידי מנגנוני הבטיחות של המודל.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("התשובה נקטעה — ייתכן שהמסמך ארוך מדי. נסה להעלות עמוד אחד בכל פעם.");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("המודל לא החזיר תוכן.");

  return {
    data: JSON.parse(textBlock.text),
    usage: response.usage,
  };
}

module.exports = { analyzeDocument, isConfigured, MODEL, AiUnavailableError, AiRefusedError };
