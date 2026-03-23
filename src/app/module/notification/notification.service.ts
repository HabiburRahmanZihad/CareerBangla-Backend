import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";

const getMyNotifications = async (user: IRequestUser) => {
    logger.read(`Fetching notifications → userId: ${user.userId}`);
    const notifications = await prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
    })
    return notifications;
}

const getUnreadCount = async (user: IRequestUser) => {
    logger.read(`Fetching unread count → userId: ${user.userId}`);
    const count = await prisma.notification.count({
        where: { userId: user.userId, isRead: false },
    })
    return { unreadCount: count };
}

const markAsRead = async (user: IRequestUser, notificationId: string) => {
    logger.update(`Marking notification as read → id: ${notificationId}`);
    const notification = await prisma.notification.update({
        where: { id: notificationId, userId: user.userId },
        data: { isRead: true },
    })
    return notification;
}

const markAllAsRead = async (user: IRequestUser) => {
    logger.update(`Marking all notifications as read → userId: ${user.userId}`);
    await prisma.notification.updateMany({
        where: { userId: user.userId, isRead: false },
        data: { isRead: true },
    })
    return { message: "All notifications marked as read" };
}

const deleteNotification = async (user: IRequestUser, notificationId: string) => {
    logger.delete(`Notification delete → id: ${notificationId}, userId: ${user.userId}`);
    await prisma.notification.delete({
        where: { id: notificationId, userId: user.userId },
    })
    return { message: "Notification deleted successfully" };
}

export const NotificationService = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
}
