import { JobStatus, JobType } from "../../../generated/prisma/enums";

export interface ICreateJobPayload {
    title: string;
    description: string;
    requirements: string[];
    responsibilities: string[];
    location: string;
    jobType: JobType;
    salaryMin?: number;
    salaryMax?: number;
    experience?: string;
    education?: string;
    skills: string[];
    benefits: string[];
    deadline: string;
    vacancies?: number;
    categoryId?: string;
}

export interface IUpdateJobPayload {
    title?: string;
    description?: string;
    requirements?: string[];
    responsibilities?: string[];
    location?: string;
    jobType?: JobType;
    salaryMin?: number;
    salaryMax?: number;
    experience?: string;
    education?: string;
    skills?: string[];
    benefits?: string[];
    deadline?: string;
    vacancies?: number;
    categoryId?: string;
    status?: JobStatus;
}
