import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RecruiterController } from "./recruiter.controller";
import { updateRecruiterZodSchema } from "./recruiter.validation";

const router = Router();

router.get("/",
    RecruiterController.getAllRecruiters);

router.get("/my-profile",
    checkAuth(Role.RECRUITER),
    RecruiterController.getMyProfile);

router.get("/:id",
    RecruiterController.getRecruiterById);

router.patch("/update-my-profile",
    checkAuth(Role.RECRUITER),
    validateRequest(updateRecruiterZodSchema),
    RecruiterController.updateMyProfile);

router.patch("/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(updateRecruiterZodSchema),
    RecruiterController.updateRecruiter);

router.delete("/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    RecruiterController.deleteRecruiter);

router.patch("/approve/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    RecruiterController.approveRecruiter);

router.patch("/reject/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    RecruiterController.rejectRecruiter);

router.get("/view-email/:recruiterId",
    checkAuth(Role.USER),
    RecruiterController.viewRecruiterEmail);

export const RecruiterRoutes = router;
