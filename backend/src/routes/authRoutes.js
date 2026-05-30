const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: "Muitas tentativas de login/registro. Tente novamente em 15 minutos.",
    standardHeaders: true,
    legacyHeaders: false
});

// ================= REGISTER =================

router.post("/register", authLimiter, authController.register);

// ================= LOGIN =================

router.post("/login", authLimiter, authController.login);

// ================= ADMIN =================

router.get(
    "/admin/overview",
    authMiddleware,
    adminMiddleware,
    authController.getAdminSessionOverview
);

router.patch(
    "/admin/status",
    authMiddleware,
    adminMiddleware,
    authController.updateAdminStatus
);

module.exports = router;
