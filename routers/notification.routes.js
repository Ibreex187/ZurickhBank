const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const validate = require("../middleware/express.validator.middleware");
const {
    notificationListRules,
    notificationIdParamRules,
    notificationPreferenceRules
} = require("../validators/validation.rules");
const {
    getNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getNotificationPreferences,
    updateNotificationPreferences
} = require("../controllers/notification.controller");

const router = express.Router();

router.use(authMiddleware);

router.get("/notifications", notificationListRules(), validate, getNotifications);
router.get("/notifications/unread-count", getUnreadCount);
router.patch("/notifications/:notificationId/read", notificationIdParamRules(), validate, markNotificationAsRead);
router.patch("/notifications/read-all", markAllNotificationsAsRead);
router.get("/notifications/preferences", getNotificationPreferences);
router.patch("/notifications/preferences", notificationPreferenceRules(), validate, updateNotificationPreferences);

module.exports = router;
