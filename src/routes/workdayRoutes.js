const router = require("express").Router();
const ah = require("../utils/asyncHandler");
const auth = require("../middleware/auth");
const c = require("../controllers/workdayController");

router.use(auth); // כל הנתיבים כאן דורשים התחברות

router.get("/", ah(c.list));
router.post("/", ah(c.upsert));
router.delete("/:date", ah(c.remove));

module.exports = router;
