import z from "zod";
import { ApplicationStatus } from "../../../generated/prisma/enums";

export const applyJobZodSchema = z.object({
    jobId: z.uuid("Job ID must be a valid UUID"),
    coverLetter: z.string("Cover letter must be a string").optional(),
})

export const updateApplicationStatusZodSchema = z.object({
    status: z.enum([
        ApplicationStatus.PENDING,
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.HIRED,
        ApplicationStatus.REJECTED,
    ], "Invalid application status"),
    interviewDate: z.string("Interview date must be a string").optional(),
    interviewNote: z.string("Interview note must be a string").optional(),
    hiredCompany: z.string("Hired company must be a string").optional(),
    hiredDesignation: z.string("Hired designation must be a string").optional(),
})
