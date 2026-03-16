import z from "zod";
import { Gender } from "../../../generated/prisma/enums";

export const updateResumeZodSchema = z.object({
    title: z.string("Title must be a string").optional(),
    summary: z.string("Summary must be a string").optional(),
    skills: z.array(z.string()).optional(),
    experience: z.array(z.object({
        company: z.string("Company is required"),
        position: z.string("Position is required"),
        startDate: z.string("Start date is required"),
        endDate: z.string("End date must be a string").optional(),
        description: z.string("Description must be a string").optional(),
        isCurrent: z.boolean("isCurrent must be a boolean").optional(),
    })).optional(),
    education: z.array(z.object({
        institution: z.string("Institution is required"),
        degree: z.string("Degree is required"),
        fieldOfStudy: z.string("Field of study must be a string").optional(),
        startDate: z.string("Start date is required"),
        endDate: z.string("End date must be a string").optional(),
        grade: z.string("Grade must be a string").optional(),
    })).optional(),
    certifications: z.array(z.object({
        name: z.string("Certification name is required"),
        issuer: z.string("Issuer must be a string").optional(),
        issueDate: z.string("Issue date must be a string").optional(),
        expiryDate: z.string("Expiry date must be a string").optional(),
        credentialUrl: z.string("Credential URL must be a string").optional(),
    })).optional(),
    languages: z.array(z.string()).optional(),
    linkedinUrl: z.url("LinkedIn URL must be a valid URL").optional(),
    portfolioUrl: z.url("Portfolio URL must be a valid URL").optional(),
    resumeFileUrl: z.url("Resume file URL must be a valid URL").optional(),
    gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]).optional(),
    dateOfBirth: z.string("Date of birth must be a string").optional(),
    contactNumber: z.string("Contact number must be a string").optional(),
    address: z.string("Address must be a string").optional(),
})
