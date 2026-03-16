import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { NotificationController } from "./notification.controller";

const router = Router();

router.get("/",
    checkAuth(Role.USER, Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    NotificationController.getMyNotifications);

router.get("/unread-count",
    checkAuth(Role.USER, Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    NotificationController.getUnreadCount);

router.patch("/read/:id",
    checkAuth(Role.USER, Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    NotificationController.markAsRead);

router.patch("/read-all",
    checkAuth(Role.USER, Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    NotificationController.markAllAsRead);

router.delete("/:id",
    checkAuth(Role.USER, Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    NotificationController.deleteNotification);

export const NotificationRoutes = router;
