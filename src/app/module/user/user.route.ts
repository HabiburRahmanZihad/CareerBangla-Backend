/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from "express";
import multer from "multer";
import { Role } from "../../../generated/prisma/enums";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { createAdminZodSchema, createRecruiterZodSchema } from "./user.validation";

const router = Router();

// Configure multer for handling multipart/form-data (in-memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to transform multipart/form-data to JSON structure
const transformFormDataToJson = (req: any, _res: any, next: any) => {
    if (req.is('multipart/form-data') || (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0)) {
        // FormData fields come as flat properties, we need to restructure them
        const body = req.body || {};

        // Check if this looks like FormData that needs restructuring
        if (body.name || body.companyName) {
            // Transform flat FormData structure to nested structure
            req.body = {
                password: body.password,
                recruiter: {
                    name: body.name,
                    email: body.email,
                    contactNumber: body.contactNumber,
                    companyName: body.companyName,
                    companyLogo: body.companyLogo,
                    companyWebsite: body.companyWebsite,
                    companyAddress: body.companyAddress,
                    designation: body.designation,
                    industry: body.industry,
                    companySize: body.companySize,
                    description: body.description,
                    profilePhoto: body.profilePhoto,
                }
            };
        }
    }
    next();
};

router.post("/create-recruiter",
    upload.any(),
    transformFormDataToJson,
    validateRequest(createRecruiterZodSchema),
    UserController.createRecruiter);

router.post("/create-admin",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(createAdminZodSchema),
    UserController.createAdmin);

export const UserRoutes = router;
