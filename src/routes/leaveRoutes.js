const router = require("express").Router();
const ah = require("../utils/asyncHandler");
const auth = require("../middleware/auth");
const c = require("../controllers/leaveController");

router.use(auth);
router.get("/balance", ah(c.balance));

module.exports = router;
