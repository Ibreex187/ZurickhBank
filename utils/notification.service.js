const NotificationModel = require("../models/notification.model");
const NotificationPreferenceModel = require("../models/notification.preference.model");
const UserModel = require("../models/user.model");
const { sendNotificationEmail } = require("./mailer");

const NOTIFICATION_CATEGORIES = ["debit", "credit", "transfer", "security"];

async function getOrCreateNotificationPreferences(userId, session = null) {
    let query = NotificationPreferenceModel.findOne({ userId });

    if (session) {
        query = query.session(session);
    }

    let preferences = await query;

    if (!preferences) {
        preferences = new NotificationPreferenceModel({ userId });
        await preferences.save(session ? { session } : undefined);
    }

    return preferences;
}

async function createNotification({ userId, category, title, message, metadata = {}, session = null }) {
    const notification = new NotificationModel({
        userId,
        category,
        title,
        message,
        metadata
    });

    await notification.save(session ? { session } : undefined);

    try {
        const preferences = await getOrCreateNotificationPreferences(userId, session);
        const isEmailEnabledForCategory = preferences?.emailByCategory?.[category] !== false;

        if (isEmailEnabledForCategory) {
            let userQuery = UserModel.findById(userId).select("firstName lastName email");
            if (session) {
                userQuery = userQuery.session(session);
            }

            const user = await userQuery;
            if (user?.email) {
                await sendNotificationEmail({
                    to: user.email,
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    title,
                    message
                });
            }
        }
    } catch (error) {
        // Notification write should not fail because email delivery failed.
    }

    return notification;
}

module.exports = {
    createNotification,
    getOrCreateNotificationPreferences,
    NOTIFICATION_CATEGORIES
};
