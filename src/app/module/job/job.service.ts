import status from "http-status";
import { Job, Prisma } from "../../../generated/prisma/client";
import { PaymentStatus, RecruiterStatus, SubscriptionPlan } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";
import { getRecruiterProfileCompletion } from "../../utils/profileCompletion";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { jobFilterableFields, jobSearchableFields } from "./job.constant";
import { ICreateJobPayload, IUpdateJobPayload } from "./job.interface";

// Helper function to check if recruiter has active subscription
const hasActiveRecruiterSubscription = async (userId: string): Promise<boolean> => {
    const subscription = await prisma.subscription.findFirst({
        where: {
            userId,
            isRecruiterSubscription: true,
            status: PaymentStatus.PAID,
            plan: {
                in: [SubscriptionPlan.RECRUITER_MONTHLY, SubscriptionPlan.RECRUITER_6_MONTHS, SubscriptionPlan.RECRUITER_YEARLY]
            }
        }
    });

    if (!subscription) return false;

    // Check if subscription is still active (not expired)
    if (subscription.currentPeriodEnd) {
        return new Date() < new Date(subscription.currentPeriodEnd);
    }

    return true;
};

const createJob = async (user: IRequestUser, payload: ICreateJobPayload) => {
    logger.create(`Job creation requested → userId: ${user.userId}, title: ${payload.title}`);
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

    // Check if recruiter has active subscription
    const hasSubscription = await hasActiveRecruiterSubscription(user.userId);
    if (!hasSubscription) {
        throw new AppError(
            status.PAYMENT_REQUIRED,
            "You need an active recruiter subscription to post jobs. Please upgrade your subscription."
        );
    }

    const result = await prisma.$transaction(async (tx) => {
        // Create job post notification
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

        // Job posted notification
        await tx.notification.create({
            data: {
                userId: user.userId,
                type: "JOB_POSTED",
                title: "Job Posted Successfully",
                message: `Your job "${payload.title}" has been posted successfully.`,
            }
        });

        logger.create(`Job created → id: ${job.id}, title: ${payload.title}`);
        return job;
    })

    return result;
}

const getAllJobs = async (query: IQueryParams) => {
    logger.read("Fetching all jobs", { filters: query });
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
    logger.read(`Fetching job → id: ${id}`);
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
    logger.read(`Fetching recruiter jobs → userId: ${user.userId}`, { filters: query });
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
    logger.update(`Job update requested → id: ${id}, userId: ${user.userId}`);
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

    logger.update(`Job updated → id: ${id}`);
    return updatedJob;
}

const deleteJob = async (id: string, user: IRequestUser) => {
    logger.delete(`Job delete requested → id: ${id}, userId: ${user.userId}`);
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

    logger.delete(`Job deleted → id: ${id}`);
    return { message: "Job deleted successfully" };
}

// Job Categories
const createCategory = async (title: string, icon?: string) => {
    logger.create(`Category creation requested → title: ${title}`);
    const category = await prisma.jobCategory.create({
        data: { title, icon },
    })
    logger.create(`Category created → id: ${category.id}, title: ${title}`);
    return category;
}

const getAllCategories = async () => {
    logger.read("Fetching all job categories");
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
    logger.delete(`Category delete requested → id: ${id}`);
    await prisma.jobCategory.delete({
        where: { id },
    })
    logger.delete(`Category deleted → id: ${id}`);
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
