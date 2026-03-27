import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { JobController } from "./job.controller";
import { createJobZodSchema, updateJobZodSchema } from "./job.validation";

const router = Router();

// Job Categories
router.post("/categories",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    JobController.createCategory);

router.get("/categories",
    JobController.getAllCategories);

router.delete("/categories/:id",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    JobController.deleteCategory);

// Jobs
router.post("/",
    checkAuth(Role.RECRUITER),
    validateRequest(createJobZodSchema),
    JobController.createJob);

router.get("/",
    JobController.getAllJobs);

router.get("/my-jobs",
    checkAuth(Role.RECRUITER),
    JobController.getMyJobs);

router.get("/:id",
    JobController.getJobById);

router.patch("/:id",
    checkAuth(Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(updateJobZodSchema),
    JobController.updateJob);

router.delete("/:id",
    checkAuth(Role.RECRUITER, Role.ADMIN, Role.SUPER_ADMIN),
    JobController.deleteJob);

// Admin Job Approval Endpoints
router.patch("/:id/approve",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    JobController.approveJob);

router.patch("/:id/reject",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    JobController.rejectJob);

router.get("/admin/pending",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    JobController.getPendingJobs);

export const JobRoutes = router;
