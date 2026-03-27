import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import { updateAdminZodSchema, updateSubscriptionPlanZodSchema } from "./admin.validation";

const router = Router();

router.get("/",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.getAllAdmins);
router.get("/users",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.getAllUsers);
router.get("/users-with-details",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.getAllUsersWithDetails);
router.get("/recruiters-with-details",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.getAllRecruitersWithDetails);
router.get("/jobs",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.getAllJobs);
router.patch("/jobs/:jobId",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.updateJob);
router.patch("/subscription-plans/:planKey",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(updateSubscriptionPlanZodSchema),
    AdminController.updateSubscriptionPlan);
router.patch("/change-user-status",
    checkAuth(Role.SUPER_ADMIN, Role.ADMIN),
    AdminController.changeUserStatus);
router.patch("/change-user-role",
    checkAuth(Role.SUPER_ADMIN),
    AdminController.changeUserRole);
router.patch("/users/:userId",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.updateUser);
router.delete("/users/:userId",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.deleteUser);
router.patch("/recruiters/:recruiterId",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.updateRecruiterData);

router.get("/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    AdminController.getAdminById);
router.patch("/:id",
    checkAuth(Role.SUPER_ADMIN),
    validateRequest(updateAdminZodSchema), AdminController.updateAdmin);
router.delete("/:id",
    checkAuth(Role.SUPER_ADMIN),
    AdminController.deleteAdmin);


export const AdminRoutes = router;
