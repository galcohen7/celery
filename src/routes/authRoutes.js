const router = require("express").Router();
const ah = require("../utils/asyncHandler");
const c = require("../controllers/authController");

router.post("/register", ah(c.register));
router.post("/login", ah(c.login));
router.post("/forgot-password", ah(c.requestPasswordReset));
router.post("/reset-password", ah(c.resetPassword));

module.exports = router;
