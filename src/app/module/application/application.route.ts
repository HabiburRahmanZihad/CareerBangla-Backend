import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ApplicationController } from "./application.controller";
import { applyJobZodSchema, updateApplicationStatusZodSchema } from "./application.validation";

const router = Router();

router.post("/apply",
    checkAuth(Role.USER),
    validateRequest(applyJobZodSchema),
    ApplicationController.applyJob);

router.get("/my-applications",
    checkAuth(Role.USER),
    ApplicationController.getMyApplications);

router.get("/all",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    ApplicationController.getAllApplications);

router.get("/job/:jobId",
    checkAuth(Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    ApplicationController.getJobApplications);

router.patch("/status/:id",
    checkAuth(Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(updateApplicationStatusZodSchema),
    ApplicationController.updateApplicationStatus);

// Recruiter features
router.get("/job/:jobId/applicants",
    checkAuth(Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    ApplicationController.getApplicantsForJob);

router.get("/directory/users",
    checkAuth(Role.RECRUITER),
    ApplicationController.getUserDirectory);

export const ApplicationRoutes = router;
