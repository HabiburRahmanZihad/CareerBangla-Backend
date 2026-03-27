import status from "http-status";
import { Job, Prisma } from "../../../generated/prisma/client";
import { PaymentStatus, RecruiterStatus, SubscriptionPlan } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
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
        // Create job post as DRAFT (awaiting admin approval)
        const job = await tx.job.create({
            data: {
                ...payload,
                deadline: new Date(payload.deadline),
                recruiterId: recruiter.id,
                status: "DRAFT", // Save as draft awaiting approval
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
                title: "Job Posted for Review",
                message: `Your job "${payload.title}" has been submitted for admin review. You will be notified once it's approved.`,
            }
        });

        logger.create(`Job created (DRAFT) → id: ${job.id}, title: ${payload.title}`);
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

    const isAdminUpdater = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    const isRecruiterOwnerUpdater = !isAdminUpdater && job.recruiter.userId === user.userId;

    const contentUpdateFields: Array<keyof IUpdateJobPayload> = [
        "title",
        "description",
        "requirements",
        "responsibilities",
        "location",
        "jobType",
        "salaryMin",
        "salaryMax",
        "experience",
        "education",
        "skills",
        "benefits",
        "deadline",
        "vacancies",
        "categoryId",
    ];

    const hasContentUpdate = contentUpdateFields.some((field) => payload[field] !== undefined);

    // Recruiter edits to live/rejected jobs must go back to pending for admin review.
    if (isRecruiterOwnerUpdater && (job.status === "ACTIVE" || job.status === "CLOSED") && hasContentUpdate) {
        updateData.status = "DRAFT";
    }

    const updatedJob = await prisma.job.update({
        where: { id },
        data: updateData,
        include: { recruiter: true, category: true },
    })

    logger.update(`Job updated → id: ${id}, resetToDraft: ${Boolean(isRecruiterOwnerUpdater && (job.status === "ACTIVE" || job.status === "CLOSED") && hasContentUpdate)}`);
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

const approveJob = async (jobId: string, user: IRequestUser) => {
    logger.update(`Job approval requested → id: ${jobId}, adminId: ${user.userId}`);
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { recruiter: true }
    })

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found");
    }

    if (job.status !== "DRAFT") {
        throw new AppError(status.BAD_REQUEST, `Job must be in DRAFT status to approve. Current status: ${job.status}`);
    }

    const updatedJob = await prisma.$transaction(async (tx) => {
        const updated = await tx.job.update({
            where: { id: jobId },
            data: { status: "ACTIVE" },
            include: { recruiter: true, category: true }
        })

        // Notify recruiter
        await tx.notification.create({
            data: {
                userId: job.recruiter.userId,
                type: "JOB_POSTED",
                title: "Job Approved",
                message: `Your job "${job.title}" has been approved and is now live!`,
                metadata: { jobId: job.id },
            }
        });

        logger.update(`Job approved → id: ${jobId}`);
        return updated;
    })

    // Best-effort email to recruiter for approved job.
    sendEmail({
        to: job.recruiter.email,
        subject: `Job Approved: ${job.title}`,
        templateName: "jobApproved",
        templateData: {
            recruiterName: job.recruiter.name,
            jobTitle: job.title,
            companyName: job.company,
            location: job.location,
            category: (updatedJob as any).category?.title || "Not specified",
        },
    }).catch(() => {
        logger.error(`Failed to send job approval email → jobId: ${job.id}, recruiterId: ${job.recruiter.userId}`);
    });

    return updatedJob;
}

const rejectJob = async (jobId: string, reason: string, user: IRequestUser) => {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
        throw new AppError(status.BAD_REQUEST, "Rejection reason is required");
    }

    logger.update(`Job rejection requested → id: ${jobId}, adminId: ${user.userId}, reason: ${trimmedReason}`);
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { recruiter: true, category: true }
    })

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found");
    }

    if (job.status !== "DRAFT") {
        throw new AppError(status.BAD_REQUEST, `Job must be in DRAFT status to reject. Current status: ${job.status}`);
    }

    const updatedJob = await prisma.$transaction(async (tx) => {
        const updated = await tx.job.update({
            where: { id: jobId },
            data: { status: "CLOSED" },
            include: { recruiter: true, category: true }
        })

        // Notify recruiter
        await tx.notification.create({
            data: {
                userId: job.recruiter.userId,
                type: "GENERAL",
                title: "Job Rejected",
                message: `Your job "${job.title}" was rejected. Reason: ${trimmedReason}`,
                metadata: { jobId: job.id },
            }
        });

        logger.update(`Job rejected → id: ${jobId}`);
        return updated;
    })

    // Best-effort email to recruiter with rejection details and resubmission guidance.
    sendEmail({
        to: job.recruiter.email,
        subject: `Action Required: Job Post Rejected - ${job.title}`,
        templateName: "jobRejected",
        templateData: {
            recruiterName: job.recruiter.name,
            jobTitle: job.title,
            companyName: job.company,
            location: job.location,
            category: job.category?.title || "Not specified",
            reason: trimmedReason,
            adminEmail: user.email,
        },
    }).catch(() => {
        logger.error(`Failed to send job rejection email → jobId: ${job.id}, recruiterId: ${job.recruiter.userId}`);
    });

    return updatedJob;
}

const getPendingJobs = async (query: IQueryParams) => {
    logger.read("Fetching pending jobs (admin)", { filters: query });
    const page = parseInt(query?.page || "1");
    const limit = parseInt(query?.limit || "20");
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
        prisma.job.findMany({
            where: { status: "DRAFT", isDeleted: false },
            include: {
                recruiter: {
                    select: {
                        id: true,
                        name: true,
                        companyName: true,
                        userId: true
                    }
                },
                category: true,
                _count: { select: { applications: true } }
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.job.count({ where: { status: "DRAFT", isDeleted: false } })
    ]);

    return {
        data: jobs,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

const getPendingJobById = async (jobId: string) => {
    logger.read(`Fetching pending job by id (admin) → jobId: ${jobId}`);

    const job = await prisma.job.findFirst({
        where: {
            id: jobId,
            status: "DRAFT",
            isDeleted: false,
        },
        include: {
            recruiter: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    companyName: true,
                    userId: true,
                },
            },
            category: true,
            _count: { select: { applications: true } },
        },
    });

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Pending job not found");
    }

    return job;
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
    approveJob,
    rejectJob,
    getPendingJobs,
    getPendingJobById,
}
