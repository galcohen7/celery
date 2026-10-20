const router = require("express").Router();
const ah = require("../utils/asyncHandler");
const auth = require("../middleware/auth");
const c = require("../controllers/jobController");

router.use(auth);
router.get("/", ah(c.list));
router.post("/", ah(c.create));
router.post("/preview", c.preview);
router.put("/:id", ah(c.update));
router.post("/:id/activate", ah(c.activate));
router.delete("/:id", ah(c.remove));

module.exports = router;
