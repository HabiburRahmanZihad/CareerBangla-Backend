import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { createAdminZodSchema, createRecruiterZodSchema } from "./user.validation";

const router = Router();

router.post("/create-recruiter",
    validateRequest(createRecruiterZodSchema),
    UserController.createRecruiter);

router.post("/create-admin",
    checkAuth(Role.SUPER_ADMIN),
    validateRequest(createAdminZodSchema),
    UserController.createAdmin);

export const UserRoutes = router;
