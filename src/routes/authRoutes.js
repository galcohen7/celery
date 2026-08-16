const router = require("express").Router();
const ah = require("../utils/asyncHandler");
const auth = require("../middleware/auth");
const c = require("../controllers/authController");

router.post("/register", ah(c.register));
router.post("/login", ah(c.login));
router.get("/me", auth, ah(c.me));
router.post("/forgot-password", ah(c.requestPasswordReset));
router.post("/reset-password", ah(c.resetPassword));

module.exports = router;
