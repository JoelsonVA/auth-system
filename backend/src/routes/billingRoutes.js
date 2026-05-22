const express = require("express");

const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const billingController = require("../controllers/billingController");

router.get("/status", authMiddleware, billingController.getStatus);
router.post("/checkout-session", authMiddleware, billingController.createCheckoutSession);
router.post("/portal", authMiddleware, billingController.createPortalSession);

module.exports = router;
