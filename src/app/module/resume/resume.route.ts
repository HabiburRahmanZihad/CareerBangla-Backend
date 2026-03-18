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

router.delete("/my-resume",
    checkAuth(Role.USER),
    ResumeController.deleteMyResume);

router.post("/ats-score",
    checkAuth(Role.USER),
    ResumeController.getAtsScore);

router.get("/search-candidates",
    checkAuth(Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    ResumeController.searchCandidates);

router.get("/user/:userId",
    checkAuth(Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    ResumeController.getResumeByUserId);

export const ResumeRoutes = router;
