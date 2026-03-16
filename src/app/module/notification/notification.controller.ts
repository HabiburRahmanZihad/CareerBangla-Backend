import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { NotificationService } from "./notification.service";

const getMyNotifications = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await NotificationService.getMyNotifications(user);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Notifications fetched successfully",
            data: result,
        })
    }
)

const getUnreadCount = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await NotificationService.getUnreadCount(user);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Unread count fetched successfully",
            data: result,
        })
    }
)

const markAsRead = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { id } = req.params;
        const result = await NotificationService.markAsRead(user, id as string);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Notification marked as read",
            data: result,
        })
    }
)

const markAllAsRead = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await NotificationService.markAllAsRead(user);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "All notifications marked as read",
            data: result,
        })
    }
)

const deleteNotification = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { id } = req.params;
        const result = await NotificationService.deleteNotification(user, id as string);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Notification deleted successfully",
            data: result,
        })
    }
)

export const NotificationController = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
}
