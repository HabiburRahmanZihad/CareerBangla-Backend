import { Router } from "express";
import multer from "multer";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ResumeController } from "./resume.controller";
import { updateResumeZodSchema } from "./resume.validation";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

router.get("/download-pdf",
    checkAuth(Role.USER, Role.RECRUITER),
    ResumeController.downloadResumePdf);

router.post("/upload-photo",
    checkAuth(Role.USER),
    upload.single("photo"),
    ResumeController.uploadProfilePhoto);

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
