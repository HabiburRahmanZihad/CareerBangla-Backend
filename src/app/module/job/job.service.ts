import status from "http-status";
import { Job, Prisma } from "../../../generated/prisma/client";
import { RecruiterStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { IQueryParams } from "../../interfaces/query.interface";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { getRecruiterProfileCompletion } from "../../utils/profileCompletion";
import { jobFilterableFields, jobSearchableFields } from "./job.constant";
import { ICreateJobPayload, IUpdateJobPayload } from "./job.interface";

const createJob = async (user: IRequestUser, payload: ICreateJobPayload) => {
    const recruiter = await prisma.recruiter.findUnique({
        where: { userId: user.userId }
    })

    if (!recruiter) {
        throw new AppError(status.NOT_FOUND, "Recruiter profile not found");
    }

    if (recruiter.status !== RecruiterStatus.APPROVED) {
        throw new AppError(status.FORBIDDEN, "Your recruiter account is not yet approved. Please wait for admin approval.");
    }

    // Check recruiter profile completion === 100%
    const profileCompletion = getRecruiterProfileCompletion(recruiter);
    if (profileCompletion < 100) {
        throw new AppError(status.BAD_REQUEST, `Your recruiter profile is ${profileCompletion}% complete. You must complete 100% of your profile before posting jobs.`);
    }

    const result = await prisma.$transaction(async (tx) => {

        // Job posted notification
        await tx.notification.create({
            data: {
                userId: user.userId,
                type: "JOB_POSTED",
                title: "Job Posted",
                message: `Your job "${payload.title}" has been posted successfully.`,
            }
        })

        const job = await tx.job.create({
            data: {
                ...payload,
                deadline: new Date(payload.deadline),
                recruiterId: recruiter.id,
            },
            include: {
                recruiter: true,
                category: true,
            }
        })

        return job;
    })

    return result;
}

const getAllJobs = async (query: IQueryParams) => {
    const queryBuilder = new QueryBuilder<Job>(
        prisma.job,
        query,
        {
            searchableFields: jobSearchableFields,
            filterableFields: jobFilterableFields,
        }
    )

    const result = await queryBuilder
        .search()
        .filter()
        .where({ isDeleted: false, status: "ACTIVE" })
        .include({
            recruiter: {
                select: {
                    id: true,
                    name: true,
                    companyName: true,
                    companyLogo: true,
                    industry: true,
                }
            },
            category: true,
            _count: {
                select: { applications: true }
            }
        })
        .paginate()
        .sort()
        .fields()
        .execute();

    return result;
}

const getJobById = async (id: string) => {
    const job = await prisma.job.findUnique({
        where: { id, isDeleted: false },
        include: {
            recruiter: {
                select: {
                    id: true,
                    name: true,
                    companyName: true,
                    companyLogo: true,
                    companyWebsite: true,
                    companyAddress: true,
                    industry: true,
                    companySize: true,
                    description: true,
                }
            },
            category: true,
            _count: {
                select: { applications: true }
            }
        }
    })

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found");
    }

    return job;
}

const getMyJobs = async (user: IRequestUser, query: IQueryParams) => {
    const recruiter = await prisma.recruiter.findUnique({
        where: { userId: user.userId }
    })

    if (!recruiter) {
        throw new AppError(status.NOT_FOUND, "Recruiter profile not found");
    }

    const queryBuilder = new QueryBuilder<Job>(
        prisma.job,
        query,
        {
            searchableFields: ['title', 'location'],
            filterableFields: ['status', 'jobType'],
        }
    )

    const result = await queryBuilder
        .search()
        .filter()
        .where({ recruiterId: recruiter.id, isDeleted: false })
        .include({
            category: true,
            applications: {
                include: {
                    user: {
                        select: { id: true, name: true, email: true, image: true }
                    }
                }
            },
            _count: {
                select: { applications: true }
            }
        })
        .paginate()
        .sort()
        .fields()
        .execute();

    return result;
}

const updateJob = async (id: string, user: IRequestUser, payload: IUpdateJobPayload) => {
    const job = await prisma.job.findUnique({
        where: { id },
        include: { recruiter: true }
    })

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found");
    }

    // Only the job owner or admin can update
    if (job.recruiter.userId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "You are not authorized to update this job");
    }

    const updateData: Prisma.JobUpdateInput = { ...payload };
    if (payload.deadline) {
        updateData.deadline = new Date(payload.deadline);
    }

    const updatedJob = await prisma.job.update({
        where: { id },
        data: updateData,
        include: { recruiter: true, category: true },
    })

    return updatedJob;
}

const deleteJob = async (id: string, user: IRequestUser) => {
    const job = await prisma.job.findUnique({
        where: { id },
        include: { recruiter: true }
    })

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found");
    }

    if (job.recruiter.userId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "You are not authorized to delete this job");
    }

    await prisma.job.update({
        where: { id },
        data: {
            isDeleted: true,
            deletedAt: new Date(),
        },
    })

    return { message: "Job deleted successfully" };
}

// Job Categories
const createCategory = async (title: string, icon?: string) => {
    const category = await prisma.jobCategory.create({
        data: { title, icon },
    })
    return category;
}

const getAllCategories = async () => {
    const categories = await prisma.jobCategory.findMany({
        include: {
            _count: {
                select: { jobs: { where: { isDeleted: false, status: "ACTIVE" } } }
            }
        },
        orderBy: { title: "asc" },
    })
    return categories;
}

const deleteCategory = async (id: string) => {
    await prisma.jobCategory.delete({
        where: { id },
    })
    return { message: "Category deleted successfully" };
}

export const JobService = {
    createJob,
    getAllJobs,
    getJobById,
    getMyJobs,
    updateJob,
    deleteJob,
    createCategory,
    getAllCategories,
    deleteCategory,
}
