const express = require("express");

const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

// ================= REGISTER =================

router.post("/register", authController.register);

// ================= LOGIN =================

router.post("/login", authController.login);

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
