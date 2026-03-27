import status from "http-status";
import { Job, Prisma } from "../../../generated/prisma/client";
import { JobType, PaymentStatus, RecruiterStatus, SubscriptionPlan } from "../../../generated/prisma/enums";
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
        // Create job post as PENDING (awaiting admin approval)
        const job = await tx.job.create({
            data: {
                ...payload,
                deadline: new Date(payload.deadline),
                recruiterId: recruiter.id,
                status: "PENDING",
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

        logger.create(`Job created (PENDING) → id: ${job.id}, title: ${payload.title}`);
        return job;
    })

    return result;
}

const getAllJobs = async (query: IQueryParams) => {
    logger.read("Fetching all jobs", { filters: query });
    // Auto-update jobs with passed deadlines to INACTIVE
    await updateJobsWithPassedDeadlines();

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
        .where({ isDeleted: false, status: "LIVE" })
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
                    email: true,
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
    await updateJobsWithPassedDeadlines();
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

    // Prevent updates to inactive or closed jobs
    if (job.status === "INACTIVE" || job.status === "CLOSED") {
        throw new AppError(status.FORBIDDEN, `Cannot update a ${job.status.toLowerCase()} job. You can only delete it.`);
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

    // Recruiter edits to live jobs must go back to pending for admin review.
    if (isRecruiterOwnerUpdater && job.status === "LIVE" && hasContentUpdate) {
        updateData.status = "PENDING";
    }

    const updatedJob = await prisma.job.update({
        where: { id },
        data: updateData,
        include: { recruiter: true, category: true },
    })

    logger.update(`Job updated → id: ${id}, movedToPending: ${Boolean(isRecruiterOwnerUpdater && job.status === "LIVE" && hasContentUpdate)}`);
    return updatedJob;
}

const deleteJob = async (id: string, user: IRequestUser, reason?: string) => {
    logger.delete(`Job delete requested → id: ${id}, userId: ${user.userId}, reason: ${reason || "No reason provided"}`);
    const job = await prisma.job.findUnique({
        where: { id },
        include: {
            recruiter: {
                include: { user: true }
            }
        }
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

    // Send email to recruiter only if deleted by admin with a reason
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
        const recruiterEmail = job.recruiter.user.email;
        if (recruiterEmail && reason) {
            try {
                const { sendEmail } = await import("../../utils/email");
                const formattedDate = new Date(job.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                await sendEmail({
                    to: recruiterEmail,
                    subject: `Job Deleted: ${job.title}`,
                    templateName: "jobDeleted",
                    templateData: {
                        recruiterName: job.recruiter.user.name || "Recruiter",
                        jobTitle: job.title,
                        company: job.recruiter.companyName || "N/A",
                        location: job.location || "N/A",
                        jobType: job.jobType || "N/A",
                        jobStatus: job.status || "N/A",
                        createdAt: formattedDate,
                        reason: reason || "No specific reason provided"
                    }
                });
                logger.create(`Deletion notification email sent to ${recruiterEmail}`);
            } catch (error) {
                logger.error(`Failed to send deletion notification email to ${recruiterEmail}`, error);
            }
        }
    }

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
                select: { jobs: { where: { isDeleted: false, status: "LIVE" } } }
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

    if (job.status !== "PENDING") {
        throw new AppError(status.BAD_REQUEST, `Job must be in PENDING status to approve. Current status: ${job.status}`);
    }

    const updatedJob = await prisma.$transaction(async (tx) => {
        const updated = await tx.job.update({
            where: { id: jobId },
            data: { status: "LIVE" },
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
            companyName: job.recruiter.companyName || "Not specified",
            location: job.location,
            category: updatedJob.category?.title || "Not specified",
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

    if (job.status !== "PENDING") {
        throw new AppError(status.BAD_REQUEST, `Job must be in PENDING status to reject. Current status: ${job.status}`);
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
            companyName: job.recruiter.companyName || "Not specified",
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
    await updateJobsWithPassedDeadlines();
    const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
    const parsedLimit = Number.parseInt(query.limit || "20", 10) || 20;
    const limit = Math.min(100, Math.max(1, parsedLimit));
    const skip = (page - 1) * limit;

    const searchTerm = query.searchTerm?.trim();
    const jobTypeFilter = query.jobType?.trim();
    const locationTypeFilter = query.locationType?.trim();
    const categoryIdFilter = query.categoryId?.trim();

    const andConditions: Prisma.JobWhereInput[] = [];

    if (searchTerm) {
        andConditions.push({
            OR: [
                { title: { contains: searchTerm, mode: "insensitive" } },
                { description: { contains: searchTerm, mode: "insensitive" } },
                { recruiter: { companyName: { contains: searchTerm, mode: "insensitive" } } },
                { location: { contains: searchTerm, mode: "insensitive" } },
            ],
        });
    }

    const validJobTypes = new Set<string>(Object.values(JobType));
    if (jobTypeFilter && jobTypeFilter !== "ALL" && validJobTypes.has(jobTypeFilter)) {
        andConditions.push({ jobType: jobTypeFilter as JobType });
    }

    if (locationTypeFilter && locationTypeFilter !== "ALL") {
        andConditions.push({
            location: { contains: locationTypeFilter, mode: "insensitive" },
        });
    }

    if (categoryIdFilter && categoryIdFilter !== "ALL") {
        andConditions.push({ categoryId: categoryIdFilter });
    }

    const where: Prisma.JobWhereInput = {
        status: "PENDING",
        isDeleted: false,
        ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [jobs, total] = await Promise.all([
        prisma.job.findMany({
            where,
            include: {
                recruiter: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
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
        prisma.job.count({ where })
    ]);

    return {
        data: jobs,
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
}

const getPendingJobById = async (jobId: string) => {
    logger.read(`Fetching pending job by id (admin) → jobId: ${jobId}`);
    await updateJobsWithPassedDeadlines();

    const job = await prisma.job.findFirst({
        where: {
            id: jobId,
            status: "PENDING",
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

// Helper function to update jobs with passed deadlines to INACTIVE
const updateJobsWithPassedDeadlines = async () => {
    logger.update("Checking and updating jobs with passed deadlines");
    const now = new Date();

    await prisma.job.updateMany({
        where: {
            status: "LIVE",
            deadline: {
                lt: now,
            },
            isDeleted: false,
        },
        data: {
            status: "INACTIVE",
        },
    });
};

// Get all inactive and closed jobs for a recruiter
const getInactiveJobs = async (user: IRequestUser, query: IQueryParams) => {
    logger.read(`Fetching inactive and closed jobs → userId: ${user.userId}`, { filters: query });
    await updateJobsWithPassedDeadlines();
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
            filterableFields: ['jobType'],
        }
    )

    const result = await queryBuilder
        .search()
        .filter()
        .where({
            recruiterId: recruiter.id,
            isDeleted: false,
            status: { in: ["INACTIVE", "CLOSED"] }
        })
        .include({
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

// Delete an inactive job
const deleteInactiveJob = async (jobId: string, user: IRequestUser) => {
    logger.delete(`Inactive job deletion requested → id: ${jobId}, userId: ${user.userId}`);
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { recruiter: true }
    })

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found");
    }

    // Only the job owner can delete inactive jobs
    if (job.recruiter.userId !== user.userId) {
        throw new AppError(status.FORBIDDEN, "You are not authorized to delete this job");
    }

    // Only INACTIVE jobs can be deleted by recruiter
    if (job.status !== "INACTIVE") {
        throw new AppError(status.BAD_REQUEST, `Only inactive jobs can be deleted. Current status: ${job.status}`);
    }

    await prisma.job.update({
        where: { id: jobId },
        data: {
            isDeleted: true,
            deletedAt: new Date(),
        },
    })

    logger.delete(`Inactive job deleted → id: ${jobId}`);
    return { message: "Inactive job deleted successfully" };
};

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
    updateJobsWithPassedDeadlines,
    getInactiveJobs,
    deleteInactiveJob,
}
