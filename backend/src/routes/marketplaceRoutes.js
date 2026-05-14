const express = require("express");

const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const marketplaceController = require("../controllers/marketplaceController");
const jobController = require("../controllers/jobController");
const userController = require("../controllers/userController");
const notificationController = require("../controllers/notificationController");

console.log("Loading marketplaceRoutes and registering user profile update route");

router.get("/freelancers", authMiddleware, marketplaceController.listFreelancers);
router.get("/me/freelancer-profile", authMiddleware, marketplaceController.getMyFreelancerProfile);
router.put("/me/freelancer-profile", authMiddleware, marketplaceController.upsertMyFreelancerProfile);

// Messages routes
router.post("/messages", authMiddleware, marketplaceController.sendMessage);
router.get("/messages", authMiddleware, marketplaceController.getMessages);

// Jobs routes
router.post("/jobs", authMiddleware, jobController.createJob);
router.get("/jobs", authMiddleware, jobController.getJobs);
router.post("/jobs/apply", authMiddleware, jobController.applyToJob);
router.get("/jobs/:jobId/applications", authMiddleware, jobController.getJobApplications);
router.put("/jobs/applications/status", authMiddleware, jobController.updateApplicationStatus);

// User management routes
router.post("/account/deactivate", authMiddleware, userController.deactivateAccount);
router.post("/account/reactivate", authMiddleware, userController.reactivateAccount);
router.delete("/account", authMiddleware, userController.deleteAccount);
router.get("/account/status", authMiddleware, userController.getAccountStatus);
router.post("/users/profile", authMiddleware, userController.updateProfile);

// Notifications routes
router.get("/notifications", authMiddleware, notificationController.getNotifications);
router.put("/notifications/:notificationId/read", authMiddleware, notificationController.markAsRead);
router.put("/notifications/read-all", authMiddleware, notificationController.markAllAsRead);
router.delete("/notifications/:notificationId", authMiddleware, notificationController.deleteNotification);
router.get("/notifications/unread-count", authMiddleware, notificationController.getUnreadCount);

// Notification routes
router.get("/notifications", authMiddleware, notificationController.getNotifications);
router.patch("/notifications/:notificationId/read", authMiddleware, notificationController.markAsRead);
router.patch("/notifications/read-all", authMiddleware, notificationController.markAllAsRead);
router.delete("/notifications/:notificationId", authMiddleware, notificationController.deleteNotification);

module.exports = router;
