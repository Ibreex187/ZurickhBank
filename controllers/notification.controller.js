const mongoose = require("mongoose");
const NotificationModel = require("../models/notification.model");
const NotificationPreferenceModel = require("../models/notification.preference.model");
const { getOrCreateNotificationPreferences, NOTIFICATION_CATEGORIES } = require("../utils/notification.service");

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);
        const unreadOnly = String(req.query.unreadOnly || "false").toLowerCase() === "true";
        const category = String(req.query.category || "").trim();

        const filter = { userId: new mongoose.Types.ObjectId(userId) };

        if (unreadOnly) {
            filter.isRead = false;
        }

        if (category) {
            filter.category = category;
        }

        const skip = (page - 1) * limit;

        const [notifications, totalNotifications, unreadCount] = await Promise.all([
            NotificationModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            NotificationModel.countDocuments(filter),
            NotificationModel.countDocuments({
                userId: new mongoose.Types.ObjectId(userId),
                isRead: false
            })
        ]);

        return res.status(200).send({
            success: true,
            message: "Notifications retrieved successfully",
            data: {
                notifications,
                unreadCount,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalNotifications / limit),
                    totalNotifications,
                    hasNextPage: skip + notifications.length < totalNotifications,
                    hasPrevPage: page > 1
                }
            }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error retrieving notifications"
        });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const unreadCount = await NotificationModel.countDocuments({
            userId: new mongoose.Types.ObjectId(req.user.userId),
            isRead: false
        });

        return res.status(200).send({
            success: true,
            message: "Unread count retrieved successfully",
            data: { unreadCount }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error retrieving unread count"
        });
    }
};

exports.markNotificationAsRead = async (req, res) => {
    try {
        const notification = await NotificationModel.findOneAndUpdate(
            {
                _id: req.params.notificationId,
                userId: new mongoose.Types.ObjectId(req.user.userId)
            },
            {
                $set: {
                    isRead: true,
                    readAt: new Date()
                }
            },
            { new: true }
        );

        if (!notification) {
            return res.status(404).send({
                success: false,
                message: "Notification not found"
            });
        }

        return res.status(200).send({
            success: true,
            message: "Notification marked as read",
            data: notification
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error marking notification as read"
        });
    }
};

exports.markAllNotificationsAsRead = async (req, res) => {
    try {
        const result = await NotificationModel.updateMany(
            {
                userId: new mongoose.Types.ObjectId(req.user.userId),
                isRead: false
            },
            {
                $set: {
                    isRead: true,
                    readAt: new Date()
                }
            }
        );

        return res.status(200).send({
            success: true,
            message: "All notifications marked as read",
            data: { updatedCount: result.modifiedCount || 0 }
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error marking all notifications as read"
        });
    }
};

exports.getNotificationPreferences = async (req, res) => {
    try {
        const preferences = await getOrCreateNotificationPreferences(req.user.userId);

        return res.status(200).send({
            success: true,
            message: "Notification preferences retrieved successfully",
            data: preferences
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error retrieving notification preferences"
        });
    }
};

exports.updateNotificationPreferences = async (req, res) => {
    try {
        const emailByCategory = req.body.emailByCategory || {};
        const update = {};

        for (const category of NOTIFICATION_CATEGORIES) {
            if (Object.prototype.hasOwnProperty.call(emailByCategory, category)) {
                update[`emailByCategory.${category}`] = Boolean(emailByCategory[category]);
            }
        }

        const preferences = await NotificationPreferenceModel.findOneAndUpdate(
            { userId: new mongoose.Types.ObjectId(req.user.userId) },
            { $set: update },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return res.status(200).send({
            success: true,
            message: "Notification preferences updated successfully",
            data: preferences
        });
    } catch (error) {
        return res.status(500).send({
            success: false,
            message: "Error updating notification preferences"
        });
    }
};
