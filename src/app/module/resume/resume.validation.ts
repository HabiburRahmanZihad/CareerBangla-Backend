import z from "zod";
import { Gender } from "../../../generated/prisma/enums";

// Personal Information Schema
const personalInfoSchema = z.object({
    fullName: z.string().min(1, "Full name is required").optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    professionalTitle: z.string().optional(),
    contactNumber: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]).optional(),
    nationality: z.string().optional(),
    address: z.string().optional(),
});

// URLs Schema
const urlsSchema = z.object({
    linkedinUrl: z.string().url("Invalid LinkedIn URL").optional().or(z.literal("")),
    githubUrl: z.string().url("Invalid GitHub URL").optional().or(z.literal("")),
    portfolioUrl: z.string().url("Invalid portfolio URL").optional().or(z.literal("")),
    websiteUrl: z.string().url("Invalid website URL").optional().or(z.literal("")),
});

// Professional Summary
const summarySchema = z.object({
    professionalSummary: z.string().max(1000, "Summary must be less than 1000 characters").optional(),
});

// Skills Schema
const skillsSchema = z.object({
    technicalSkills: z.array(z.string()).default([]),
    softSkills: z.array(z.string()).default([]),
    toolsAndTechnologies: z.array(z.string()).default([]),
});

// Work Experience Schema
const workExperienceSchema = z.object({
    jobTitle: z.string().min(1, "Job title is required"),
    companyName: z.string().min(1, "Company name is required"),
    employmentType: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().or(z.date()).refine((date) => new Date(date) instanceof Date, "Invalid start date"),
    endDate: z.string().or(z.date()).optional().refine((date) => !date || new Date(date) instanceof Date, "Invalid end date"),
    currentlyWorking: z.boolean().default(false),
    responsibilities: z.array(z.string()).default([]),
    achievements: z.array(z.string()).default([]),
    technologiesUsed: z.array(z.string()).default([]),
});

// Education Schema
const educationSchema = z.object({
    degree: z.string().min(1, "Degree is required"),
    fieldOfStudy: z.string().min(1, "Field of study is required"),
    institutionName: z.string().min(1, "Institution name is required"),
    location: z.string().optional(),
    startDate: z.string().or(z.date()).refine((date) => new Date(date) instanceof Date, "Invalid start date"),
    endDate: z.string().or(z.date()).optional().refine((date) => !date || new Date(date) instanceof Date, "Invalid end date"),
    currentlyStudying: z.boolean().default(false),
    cgpaOrResult: z.string().optional(),
    description: z.string().optional(),
});

// Certification Schema
const certificationSchema = z.object({
    certificationName: z.string().min(1, "Certification name is required"),
    issuingOrganization: z.string().min(1, "Issuing organization is required"),
    issueDate: z.string().or(z.date()).refine((date) => new Date(date) instanceof Date, "Invalid issue date"),
    expiryDate: z.string().or(z.date()).optional().refine((date) => !date || new Date(date) instanceof Date, "Invalid expiry date"),
    credentialId: z.string().optional(),
    credentialUrl: z.string().url("Invalid credential URL").optional().or(z.literal("")),
});

// Project Schema
const projectSchema = z.object({
    projectName: z.string().min(1, "Project name is required"),
    role: z.string().optional(),
    description: z.string().min(1, "Description is required"),
    technologiesUsed: z.array(z.string()).default([]),
    liveUrl: z.string().url("Invalid live URL").optional().or(z.literal("")),
    githubUrl: z.string().url("Invalid GitHub URL").optional().or(z.literal("")),
    startDate: z.string().or(z.date()).optional().refine((date) => !date || new Date(date) instanceof Date, "Invalid start date"),
    endDate: z.string().or(z.date()).optional().refine((date) => !date || new Date(date) instanceof Date, "Invalid end date"),
    highlights: z.array(z.string()).default([]),
});

// Language Schema
const languageSchema = z.object({
    language: z.string().min(1, "Language is required"),
    proficiencyLevel: z.enum(["Native", "Fluent", "Intermediate", "Beginner"]),
});

// Award Schema
const awardSchema = z.object({
    title: z.string().min(1, "Award title is required"),
    issuer: z.string().min(1, "Award issuer is required"),
    date: z.string().or(z.date()).refine((date) => new Date(date) instanceof Date, "Invalid date"),
    description: z.string().optional(),
});

// Reference Schema
const referenceSchema = z.object({
    name: z.string().min(1, "Reference name is required"),
    designation: z.string().optional(),
    company: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    relationship: z.string().optional(),
});

// Complete Resume Update Schema
export const updateResumeZodSchema = z.object({
    // Personal Information
    fullName: z.string().min(1, "Full name is required").optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    professionalTitle: z.string().optional(),
    contactNumber: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]).optional(),
    nationality: z.string().optional(),
    address: z.string().optional(),

    // URLs
    linkedinUrl: z.string().url("Invalid LinkedIn URL").optional().or(z.literal("")),
    githubUrl: z.string().url("Invalid GitHub URL").optional().or(z.literal("")),
    portfolioUrl: z.string().url("Invalid portfolio URL").optional().or(z.literal("")),
    websiteUrl: z.string().url("Invalid website URL").optional().or(z.literal("")),
    profilePhoto: z.string().optional(),

    // Professional Summary
    professionalSummary: z.string().max(1000).optional(),

    // Skills
    technicalSkills: z.array(z.string()).default([]),
    softSkills: z.array(z.string()).default([]),
    toolsAndTechnologies: z.array(z.string()).default([]),

    // Nested sections
    workExperience: z.array(workExperienceSchema).optional(),
    education: z.array(educationSchema).optional(),
    certifications: z.array(certificationSchema).optional(),
    projects: z.array(projectSchema).optional(),
    languages: z.array(languageSchema).optional(),
    awards: z.array(awardSchema).optional(),
    interests: z.array(z.string()).optional(),
    references: z.array(referenceSchema).optional(),
});

export type IUpdateResumePayload = z.infer<typeof updateResumeZodSchema>;
export type IWorkExperience = z.infer<typeof workExperienceSchema>;
export type IEducation = z.infer<typeof educationSchema>;
export type ICertification = z.infer<typeof certificationSchema>;
export type IProject = z.infer<typeof projectSchema>;
export type ILanguage = z.infer<typeof languageSchema>;
export type IAward = z.infer<typeof awardSchema>;
export type IReference = z.infer<typeof referenceSchema>;
