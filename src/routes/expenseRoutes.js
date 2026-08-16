const router = require("express").Router();
const ah = require("../utils/asyncHandler");
const auth = require("../middleware/auth");
const c = require("../controllers/expenseController");

router.use(auth); // כל הנתיבים כאן דורשים התחברות

router.get("/", ah(c.list));
router.get("/categories", c.categories);
router.post("/suggest-category", c.suggest);
router.post("/", ah(c.create));
router.put("/:id", ah(c.update));
router.delete("/:id", ah(c.remove));

module.exports = router;
