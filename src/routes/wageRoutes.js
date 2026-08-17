const router = require("express").Router();
const ah = require("../utils/asyncHandler");
const auth = require("../middleware/auth");
const c = require("../controllers/wageController");

router.use(auth);
router.get("/profile", ah(c.getProfile));
router.put("/profile", ah(c.saveProfile));
router.post("/preview", ah(c.preview));

module.exports = router;
