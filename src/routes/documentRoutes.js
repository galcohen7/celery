const router = require("express").Router();
const ah = require("../utils/asyncHandler");
const auth = require("../middleware/auth");
const { upload, handleUploadErrors } = require("../middleware/upload");
const c = require("../controllers/documentController");

router.use(auth);

router.get("/status", c.status);
router.get("/payslips", ah(c.listPayslips));

// single("file") מחזיק את הקובץ בזיכרון בלבד — ראה middleware/upload.js
router.post("/payslip", upload.single("file"), handleUploadErrors, ah(c.analyzePayslip));
router.post("/payslip/confirm", ah(c.confirmPayslip));

router.post("/statement", upload.single("file"), handleUploadErrors, ah(c.analyzeStatement));
router.post("/statement/confirm", ah(c.confirmStatement));

module.exports = router;
