import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";

const getMyNotifications = async (user: IRequestUser) => {
    const notifications = await prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
    })
    return notifications;
}

const getUnreadCount = async (user: IRequestUser) => {
    const count = await prisma.notification.count({
        where: { userId: user.userId, isRead: false },
    })
    return { unreadCount: count };
}

const markAsRead = async (user: IRequestUser, notificationId: string) => {
    const notification = await prisma.notification.update({
        where: { id: notificationId, userId: user.userId },
        data: { isRead: true },
    })
    return notification;
}

const markAllAsRead = async (user: IRequestUser) => {
    await prisma.notification.updateMany({
        where: { userId: user.userId, isRead: false },
        data: { isRead: true },
    })
    return { message: "All notifications marked as read" };
}

const deleteNotification = async (user: IRequestUser, notificationId: string) => {
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
