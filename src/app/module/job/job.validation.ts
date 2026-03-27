import z from "zod";
import { JobStatus, JobType } from "../../../generated/prisma/enums";

export const createJobZodSchema = z.object({
    title: z.string("Title is required").min(5, "Title must be at least 5 characters").max(200, "Title must be at most 200 characters"),
    description: z.string("Description is required").min(20, "Description must be at least 20 characters"),
    requirements: z.array(z.string()).min(1, "At least one requirement is required"),
    responsibilities: z.array(z.string()).min(1, "At least one responsibility is required"),
    location: z.string("Location is required").min(2, "Location must be at least 2 characters"),
    jobType: z.enum([JobType.FULL_TIME, JobType.PART_TIME, JobType.CONTRACT, JobType.INTERNSHIP, JobType.REMOTE]).optional(),
    salaryMin: z.number("Salary min must be a number").nonnegative("Salary cannot be negative").optional(),
    salaryMax: z.number("Salary max must be a number").nonnegative("Salary cannot be negative").optional(),
    experience: z.string("Experience must be a string").optional(),
    education: z.string("Education must be a string").optional(),
    skills: z.array(z.string()).optional(),
    benefits: z.array(z.string()).optional(),
    deadline: z.string("Deadline is required"),
    vacancies: z.number("Vacancies must be a number").int().positive("Vacancies must be positive").optional(),
    categoryId: z.uuid("Category ID must be a valid UUID").optional(),
})

export const updateJobZodSchema = z.object({
    title: z.string("Title must be a string").min(5, "Title must be at least 5 characters").max(200, "Title must be at most 200 characters").optional(),
    description: z.string("Description must be a string").optional(),
    requirements: z.array(z.string()).optional(),
    responsibilities: z.array(z.string()).optional(),
    location: z.string("Location must be a string").optional(),
    jobType: z.enum([JobType.FULL_TIME, JobType.PART_TIME, JobType.CONTRACT, JobType.INTERNSHIP, JobType.REMOTE]).optional(),
    salaryMin: z.number("Salary min must be a number").nonnegative("Salary cannot be negative").optional(),
    salaryMax: z.number("Salary max must be a number").nonnegative("Salary cannot be negative").optional(),
    experience: z.string("Experience must be a string").optional(),
    education: z.string("Education must be a string").optional(),
    skills: z.array(z.string()).optional(),
    benefits: z.array(z.string()).optional(),
    deadline: z.string("Deadline must be a string").optional(),
    vacancies: z.number("Vacancies must be a number").int().positive("Vacancies must be positive").optional(),
    categoryId: z.uuid("Category ID must be a valid UUID").optional(),
    status: z.enum([JobStatus.PENDING, JobStatus.LIVE, JobStatus.INACTIVE, JobStatus.CLOSED]).optional(),
})
