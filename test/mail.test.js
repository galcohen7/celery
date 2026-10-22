// בדיקות שירות המייל. fetch מוחלף בדמה — אין שליחה אמיתית.
const { test, afterEach } = require("node:test");
const assert = require("node:assert");
const mail = require("../src/services/mail");

const ENV_KEYS = ["BREVO_API_KEY", "MAIL_FROM", "APP_URL"];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const realFetch = global.fetch;

afterEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] == null ? delete process.env[k] : (process.env[k] = savedEnv[k]);
  global.fetch = realFetch;
});

test("לא מוגדר בלי מפתח או בלי שולח", () => {
  delete process.env.BREVO_API_KEY; process.env.MAIL_FROM = "a@b.co";
  assert.equal(mail.isConfigured(), false);
  process.env.BREVO_API_KEY = "k"; delete process.env.MAIL_FROM;
  assert.equal(mail.isConfigured(), false);
  process.env.MAIL_FROM = "a@b.co";
  assert.equal(mail.isConfigured(), true);
});

test("קישור האיפוס נבנה מ-APP_URL ומסיר לוכסן סופי", () => {
  process.env.APP_URL = "https://celery.example.com/";
  assert.equal(mail.resetLink("abc"), "https://celery.example.com/?reset=abc");
  delete process.env.APP_URL;
  assert.equal(mail.resetLink("abc"), null);
});

test("המייל כולל את הקוד, ואת הקישור רק כשיש APP_URL", () => {
  process.env.APP_URL = "https://x.test";
  const withLink = mail.resetEmail("tok123");
  assert.match(withLink.html, /tok123/);
  assert.match(withLink.html, /https:\/\/x\.test\/\?reset=tok123/);
  assert.match(withLink.text, /tok123/);

  delete process.env.APP_URL;
  const noLink = mail.resetEmail("tok123");
  assert.match(noLink.html, /tok123/);
  assert.doesNotMatch(noLink.html, /href=/);
});

test("שליחה: הבקשה ל-Brevo בנויה נכון", async () => {
  process.env.BREVO_API_KEY = "key-1"; process.env.MAIL_FROM = "me@example.com";
  let call;
  global.fetch = async (url, opts) => { call = { url, opts }; return { ok: true }; };

  await mail.sendPasswordReset("user@example.com", "tok");
  assert.equal(call.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(call.opts.headers["api-key"], "key-1");
  const body = JSON.parse(call.opts.body);
  assert.equal(body.sender.email, "me@example.com");
  assert.deepEqual(body.to, [{ email: "user@example.com" }]);
  assert.match(body.htmlContent, /tok/);
});

test("שליחה: תשובת שגיאה זורקת עם הסטטוס", async () => {
  process.env.BREVO_API_KEY = "bad"; process.env.MAIL_FROM = "me@example.com";
  global.fetch = async () => ({ ok: false, status: 401, text: async () => '{"message":"Key not found"}' });
  await assert.rejects(mail.sendPasswordReset("u@example.com", "tok"), /Brevo 401/);
});
