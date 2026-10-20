// בדיקות כללי ההרשמה: סיסמה ופיצול שם.
//
// שני הכללים האלה מיושמים גם בלקוח (אשף ההרשמה) וגם כאן. הכפילות מכוונת —
// הלקוח נותן משוב חי, השרת אוכף. הבדיקות כאן הן על **האוכף**.
const { test } = require("node:test");
const assert = require("node:assert");
const { passwordError } = require("../src/controllers/authController");

test("סיסמה קצרה מ-6 תווים נדחית", () => {
  assert.ok(passwordError("abc1!"));
  assert.ok(passwordError(""));
  assert.equal(passwordError("abcd12"), null);
});

test("אותיות באנגלית, ספרות וסימנים מתקבלים", () => {
  for (const pw of ["abcdef", "ABCDEF", "123456", "!@#$%^", "Aa1!bB", "p@ssW0rd"])
    assert.equal(passwordError(pw), null, pw + " היה צריך להתקבל");
});

test("אותיות שאינן אנגליות נדחות", () => {
  // זה הלב של הכלל: תו שלא ניתן להקליד בוודאות במקלדת אחרת נועל חשבון,
  // כל עוד שחזור סיסמה במייל לא מחובר.
  for (const pw of ["סיסמה123", "passסוד1", "Ωmega12", "пароль1", "密码12345"])
    assert.ok(passwordError(pw), pw + " היה צריך להידחות");
});

test("רווח נדחה", () => {
  assert.ok(passwordError("ab cd12"));
  assert.ok(passwordError(" abcd12"));
});

test("תווים שנראים כמו ASCII אך אינם — נדחים", () => {
  // מקף ארוך ומרכאות מסולסלות מגיעים מתיקון אוטומטי ונראים תקינים לעין.
  assert.ok(passwordError("pass–word"));  // en dash
  assert.ok(passwordError("pass“word"));  // ”
});

test("סיסמה ריקה או חסרה לא מפילה את הבדיקה", () => {
  assert.ok(passwordError(undefined));
  assert.ok(passwordError(null));
});
