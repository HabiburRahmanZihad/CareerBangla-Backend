/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import multer from "multer";
import { Role } from "../../../generated/prisma/enums";
import { uploadFileToCloudinary } from "../../config/cloudinary.config";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { logger } from "../../utils/logger";
import { UserController } from "./user.controller";
import { createAdminZodSchema, createRecruiterZodSchema } from "./user.validation";

const router = Router();

// Configure multer for handling multipart/form-data (in-memory storage)
const upload = multer({ storage: multer.memoryStorage() });

const tryUploadOptionalRecruiterImage = async (file?: Express.Multer.File) => {
    if (!file) {
        return undefined;
    }

    try {
        const result = await uploadFileToCloudinary(file.buffer, file.originalname);
        return result.secure_url;
    } catch (error: any) {
        logger.error("Recruiter image upload failed; continuing without image", {
            fieldName: file.fieldname,
            originalName: file.originalname,
            message: error?.message,
        });
        return undefined;
    }
};

// Upload files to Cloudinary then restructure FormData to nested JSON
const transformAndUpload = async (req: any, _res: any, next: any) => {
    try {
        const body = req.body || {};
        const files: Express.Multer.File[] = req.files || [];

        // Upload images to Cloudinary before validation
        let profilePhotoUrl: string | undefined;
        let companyLogoUrl: string | undefined;

        const profilePhotoFile = files.find(f => f.fieldname === "profilePhotoFile");
        const companyLogoFile = files.find(f => f.fieldname === "companyLogoFile");

        profilePhotoUrl = await tryUploadOptionalRecruiterImage(profilePhotoFile);
        companyLogoUrl = await tryUploadOptionalRecruiterImage(companyLogoFile);

        // Restructure flat FormData to nested object expected by Zod schema
        if (body.name || body.companyName) {
            req.body = {
                password: body.password,
                recruiter: {
                    name: body.name,
                    email: body.email,
                    ...(body.contactNumber ? { contactNumber: body.contactNumber } : {}),
                    companyName: body.companyName,
                    ...(companyLogoUrl ? { companyLogo: companyLogoUrl } : {}),
                    ...(body.companyWebsite ? { companyWebsite: body.companyWebsite } : {}),
                    ...(body.companyAddress ? { companyAddress: body.companyAddress } : {}),
                    ...(body.designation ? { designation: body.designation } : {}),
                    ...(body.industry ? { industry: body.industry } : {}),
                    ...(body.companySize ? { companySize: body.companySize } : {}),
                    ...(body.description ? { description: body.description } : {}),
                    ...(profilePhotoUrl ? { profilePhoto: profilePhotoUrl } : {}),
                },
            };
        }

        next();
    } catch (err) {
        next(err);
    }
};

router.post("/create-recruiter",
    upload.any(),
    transformAndUpload,
    validateRequest(createRecruiterZodSchema),
    UserController.createRecruiter);

router.post("/create-admin",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(createAdminZodSchema),
    UserController.createAdmin);

export const UserRoutes = router;
