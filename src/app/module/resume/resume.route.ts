import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ResumeController } from "./resume.controller";
import { updateResumeZodSchema } from "./resume.validation";

const router = Router();

router.get("/my-resume",
    checkAuth(Role.USER),
    ResumeController.getMyResume);

router.patch("/my-resume",
    checkAuth(Role.USER),
    validateRequest(updateResumeZodSchema),
    ResumeController.updateMyResume);

router.get("/search-candidates",
    checkAuth(Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    ResumeController.searchCandidates);

router.get("/user/:userId",
    checkAuth(Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    ResumeController.getResumeByUserId);

router.get("/view-recruiter-email/:recruiterId",
    checkAuth(Role.USER),
    ResumeController.viewRecruiterEmail);

export const ResumeRoutes = router;
