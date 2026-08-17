const router = require("express").Router();
const ah = require("../utils/asyncHandler");
const auth = require("../middleware/auth");
const c = require("../controllers/taxController");

router.use(auth);

router.get("/profile", ah(c.getProfile));
router.put("/profile", ah(c.saveProfile));
router.post("/calculate", ah(c.calculate));
router.get("/rates", c.rates);

module.exports = router;
