// שליחת מיילים דרך ה-API של Brevo.
//
// למה Brevo ולא SMTP: התוכנית החינמית של Render חוסמת יציאה בפורטים של
// SMTP, ולכן שליחה חייבת לעבור ב-HTTPS. למה לא Resend: בלי דומיין מאומת
// הוא שולח רק לכתובת של בעל החשבון. Brevo מסתפק באימות כתובת השולח.
//
// fetch מובנה ב-Node 20 — אין צורך בספרייה.

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

function isConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM);
}

// כתובת האתר לקישור במייל. בלי APP_URL המייל נשלח עם הקוד בלבד.
function resetLink(token) {
  const base = String(process.env.APP_URL || "").replace(/\/+$/, "");
  return base ? `${base}/?reset=${encodeURIComponent(token)}` : null;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function resetEmail(token) {
  const link = resetLink(token);
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#232E23">
  <h2 style="margin:0 0 12px">איפוס סיסמה ל-Celery</h2>
  <p>התקבלה בקשה לאיפוס הסיסמה של החשבון שלך.</p>
  ${link ? `<p><a href="${esc(link)}" style="display:inline-block;background:#354A32;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">קביעת סיסמה חדשה</a></p>
  <p style="color:#6E7A68;font-size:13px">או העתק את הקוד הבא למסך "סיסמה חדשה":</p>` : `<p>העתק את הקוד הבא למסך "סיסמה חדשה":</p>`}
  <p dir="ltr" style="font-family:monospace;font-size:13px;background:#EFF3E9;padding:10px;border-radius:8px;word-break:break-all">${esc(token)}</p>
  <p style="color:#6E7A68;font-size:13px">הקוד תקף ל-30 דקות ולשימוש אחד. אם לא ביקשת איפוס — אפשר להתעלם מהמייל.</p>
</div>`;
  const text = `איפוס סיסמה ל-Celery\n\n${link ? `קישור: ${link}\n\n` : ""}קוד: ${token}\n\nהקוד תקף ל-30 דקות. אם לא ביקשת איפוס — אפשר להתעלם.`;
  return { subject: "איפוס סיסמה ל-Celery", html, text };
}

async function sendPasswordReset(to, token) {
  const { subject, html, text } = resetEmail(token);
  const res = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: process.env.MAIL_FROM, name: "Celery" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    // גוף התשובה של Brevo מסביר את הסיבה (מפתח שגוי, שולח לא מאומת) ואינו מכיל את הקוד
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${detail.slice(0, 300)}`);
  }
}

module.exports = { isConfigured, sendPasswordReset, resetEmail, resetLink };
