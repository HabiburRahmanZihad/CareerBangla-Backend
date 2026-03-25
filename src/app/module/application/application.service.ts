import status from "http-status";
import { ApplicationStatus, TransactionPurpose, TransactionType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import { logger } from "../../utils/logger";
import { hasActivePremium } from "../../utils/premium";
import { getUserProfileCompletion } from "../../utils/profileCompletion";
import { ResumeService } from "../resume/resume.service";

const APPLICATION_COST = 10; // Cost in coins to apply for a job

const applyJob = async (user: IRequestUser, payload: { jobId: string; coverLetter?: string }) => {
    const { jobId, coverLetter } = payload;
    logger.create(`Job application requested → userId: ${user.userId}, jobId: ${jobId}`);

    // Check if user has completed their resume/ATS profile before applying
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId }
    })

    if (!resume) {
        throw new AppError(status.BAD_REQUEST, "You must complete your ATS resume profile before applying for jobs. Go to your profile and fill in your resume.");
    }

    if (!resume.skills || resume.skills.length === 0) {
        throw new AppError(status.BAD_REQUEST, "Your resume is incomplete. Please add at least your skills before applying.");
    }

    // Check profile completion === 100%
    const profileCompletion = getUserProfileCompletion(resume);
    if (profileCompletion < 100) {
        throw new AppError(status.BAD_REQUEST, `Your profile is ${profileCompletion}% complete. You must complete 100% of your profile before applying for jobs.`);
    }

    const job = await prisma.job.findUnique({
        where: { id: jobId, isDeleted: false, status: "ACTIVE" },
        include: { recruiter: true }
    })

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found or no longer active");
    }

    if (new Date(job.deadline) < new Date()) {
        throw new AppError(status.BAD_REQUEST, "Job application deadline has passed");
    }

    // Check if already applied
    const existingApplication = await prisma.application.findUnique({
        where: {
            userId_jobId: {
                userId: user.userId,
                jobId,
            }
        }
    })

    if (existingApplication) {
        throw new AppError(status.CONFLICT, "You have already applied for this job");
    }

    // Check wallet balance BEFORE transaction
    const wallet = await prisma.wallet.findUnique({
        where: { userId: user.userId }
    });

    if (!wallet || wallet.coins < APPLICATION_COST) {
        throw new AppError(
            status.BAD_REQUEST,
            `Insufficient coins. You need ${APPLICATION_COST} coins to apply for a job. You have ${wallet?.coins || 0} coins.`
        );
    }

    // All validations passed — create application with coin deduction
    const application = await prisma.$transaction(async (tx) => {
        // Deduct coins
        await tx.wallet.update({
            where: { id: wallet.id },
            data: { coins: { decrement: APPLICATION_COST } },
        });

        // Create coin transaction record
        await tx.coinTransaction.create({
            data: {
                type: TransactionType.DEBIT,
                purpose: TransactionPurpose.APPLY_JOB,
                amount: APPLICATION_COST,
                message: `Applied for job: "${job.title}"`,
                walletId: wallet.id,
            },
        });

        // Create application
        const app = await tx.application.create({
            data: {
                userId: user.userId,
                jobId,
                coverLetter,
            },
            include: {
                job: {
                    include: {
                        recruiter: true,
                    }
                },
                user: {
                    select: { id: true, name: true, email: true, image: true }
                }
            }
        });

        // Create notification for recruiter
        await tx.notification.create({
            data: {
                userId: job.recruiter.userId,
                type: "APPLICATION_SUBMITTED",
                title: "New Application Received",
                message: `${user.email} applied for "${job.title}"`,
                metadata: { applicationId: app.id, jobId: job.id },
            }
        });

        // Coin deduction notification to applicant
        await tx.notification.create({
            data: {
                userId: user.userId,
                type: "COIN_DEBITED",
                title: `${APPLICATION_COST} Coins Deducted`,
                message: `${APPLICATION_COST} coins have been deducted for applying to "${job.title}". You now have ${wallet.coins - APPLICATION_COST} coins.`,
            }
        });

        logger.create(`Job application created → id: ${app.id}, jobId: ${jobId}`);
        return app;
    });

    const recruiterUser = await prisma.user.findUnique({
        where: { id: job.recruiter.userId },
        select: { email: true, isPremium: true, premiumUntil: true },
    });

    // Send email notification to applicant (fire-and-forget with error suppression)
    sendEmail({
        to: user.email,
        subject: `Application Submitted - ${job.title}`,
        templateName: "applicationStatus",
        templateData: {
            name: application.user.name,
            jobTitle: job.title,
            companyName: job.recruiter.companyName,
            status: "submitted",
            message: "Your application has been submitted successfully. We will notify you of any updates.",
        }
    }).catch(() => { /* email delivery is best-effort */ });

    // Send email to recruiter with applicant details + CV (if recruiter is premium)
    (async () => {
        try {
            if (!recruiterUser) return;

            const recruiterIsPremium = hasActivePremium(recruiterUser);
            const applicantUser = await prisma.user.findUnique({
                where: { id: user.userId },
                select: { isPremium: true, premiumUntil: true },
            });
            const applicantIsPremium = applicantUser ? hasActivePremium(applicantUser) : false;

            const applicantResume = await prisma.resume.findUnique({
                where: { userId: user.userId },
                select: { contactNumber: true },
            });

            let cvAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
            if (recruiterIsPremium && applicantIsPremium) {
                const pdfBuffer = await ResumeService.getResumePdfForApplication(user.userId);
                if (pdfBuffer) {
                    cvAttachment = {
                        filename: `${application.user.name.replace(/\s+/g, "-")}-CV.pdf`,
                        content: pdfBuffer,
                        contentType: "application/pdf",
                    };
                }
            }

            await sendEmail({
                to: recruiterUser.email,
                subject: `New Applicant for "${job.title}" - ${application.user.name}`,
                templateName: "newApplicant",
                templateData: {
                    jobTitle: job.title,
                    applicantName: application.user.name,
                    applicantEmail: recruiterIsPremium ? user.email : null,
                    applicantPhone: recruiterIsPremium ? (applicantResume?.contactNumber || null) : null,
                    showFullDetails: recruiterIsPremium,
                    hasCvAttachment: !!cvAttachment,
                    coverLetter: coverLetter || null,
                    appliedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                },
                ...(cvAttachment ? { attachments: [cvAttachment] } : {}),
            });
        } catch {
            /* recruiter email is best-effort */
        }
    })();

    return application;
    }).catch(() => { /* email delivery is best-effort */ });

    // Send email to recruiter with applicant details + CV (if recruiter is premium)
    (async () => {
        try {
            // Parallel fetch: recruiter user, applicant resume, applicant premium status
            const [recruiterUser, applicantResume, applicantUser] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: job.recruiter.userId },
                    select: { email: true, isPremium: true, premiumUntil: true },
                }),
                prisma.resume.findUnique({
                    where: { userId: user.userId },
                    select: { contactNumber: true },
                }),
                prisma.user.findUnique({
                    where: { id: user.userId },
                    select: { isPremium: true, premiumUntil: true },
                }),
            ]);
            if (!recruiterUser) return;

            const recruiterIsPremium = hasActivePremium(recruiterUser);
            const applicantIsPremium = applicantUser ? hasActivePremium(applicantUser) : false;

            let cvAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
            if (recruiterIsPremium && applicantIsPremium) {
                const pdfBuffer = await ResumeService.getResumePdfForApplication(user.userId);
                if (pdfBuffer) {
                    cvAttachment = {
                        filename: `${application.user.name.replace(/\s+/g, "-")}-CV.pdf`,
                        content: pdfBuffer,
                        contentType: "application/pdf",
                    };
                }
            }

            await sendEmail({
                to: recruiterUser.email,
                subject: `New Applicant for "${job.title}" - ${application.user.name}`,
                templateName: "newApplicant",
                templateData: {
                    jobTitle: job.title,
                    applicantName: application.user.name,
                    applicantEmail: recruiterIsPremium ? user.email : null,
                    applicantPhone: recruiterIsPremium ? (applicantResume?.contactNumber || null) : null,
                    showFullDetails: recruiterIsPremium,
                    hasCvAttachment: !!cvAttachment,
                    coverLetter: coverLetter || null,
                    appliedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                },
                ...(cvAttachment ? { attachments: [cvAttachment] } : {}),
            });
        } catch {
            /* recruiter email is best-effort */
        }
    })();

    return application;
}

const getMyApplications = async (user: IRequestUser, query?: IQueryParams) => {
    logger.read(`Fetching user applications → userId: ${user.userId}`);
    const page = parseInt(query?.page || "1");
    const limit = parseInt(query?.limit || "20");
    const skip = (page - 1) * limit;

    const where = { userId: user.userId };

    const [applications, total] = await Promise.all([
        prisma.application.findMany({
            where,
            include: {
                job: {
                    include: {
                        recruiter: {
                            select: {
                                id: true,
                                name: true,
                                companyName: true,
                                companyLogo: true,
                            }
                        },
                        category: true,
                    }
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.application.count({ where }),
    ]);

    return {
        data: applications,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

const getJobApplications = async (user: IRequestUser, jobId: string) => {
    logger.read(`Fetching job applications → jobId: ${jobId}, userId: ${user.userId}`);
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { recruiter: true }
    })

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found");
    }

    if (job.recruiter.userId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "You are not authorized to view these applications");
    }

    // Check recruiter premium status
    const recruiterUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isPremium: true, premiumUntil: true },
    });
    const isPremiumRecruiter = recruiterUser ? hasActivePremium(recruiterUser) : false;

    const applications = await prisma.application.findMany({
        where: { jobId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: isPremiumRecruiter,
                    image: true,
                    resume: isPremiumRecruiter ? {
                        select: {
                            contactNumber: true,
                            professionalTitle: true,
                            profilePhoto: true,
                        }
                    } : false,
                }
            },
            job: true,
        },
        orderBy: { createdAt: "desc" },
    })

    return { applications, isPremiumRecruiter };
}

const updateApplicationStatus = async (
    user: IRequestUser,
    applicationId: string,
    payload: { status: ApplicationStatus; interviewDate?: string; interviewNote?: string }
) => {
    logger.update(`Application status update → id: ${applicationId}, newStatus: ${payload.status}`);
    const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: {
            job: {
                include: { recruiter: true }
            },
            user: { select: { id: true, name: true, email: true } }
        }
    })

    if (!application) {
        throw new AppError(status.NOT_FOUND, "Application not found");
    }

    if (application.job.recruiter.userId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "You are not authorized to update this application");
    }

    // Validate application status lifecycle transitions
    const validTransitions: Record<string, ApplicationStatus[]> = {
        PENDING: [ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED],
        SHORTLISTED: [ApplicationStatus.INTERVIEW, ApplicationStatus.REJECTED],
        INTERVIEW: [ApplicationStatus.HIRED, ApplicationStatus.REJECTED],
        HIRED: [],
        REJECTED: [],
    };

    const allowedNextStatuses = validTransitions[application.status];
    if (!allowedNextStatuses || !allowedNextStatuses.includes(payload.status)) {
        throw new AppError(
            status.BAD_REQUEST,
            `Cannot transition from ${application.status} to ${payload.status}. Allowed transitions: ${allowedNextStatuses?.join(", ") || "none (terminal state)"}`
        );
    }

    const updateData: { status: ApplicationStatus; interviewDate?: Date; interviewNote?: string } = {
        status: payload.status,
    };

    if (payload.interviewDate) {
        updateData.interviewDate = new Date(payload.interviewDate);
    }
    if (payload.interviewNote) {
        updateData.interviewNote = payload.interviewNote;
    }

    const updatedApplication = await prisma.$transaction(async (tx) => {
        const updated = await tx.application.update({
            where: { id: applicationId },
            data: updateData,
            include: {
                job: { include: { recruiter: true } },
                user: { select: { id: true, name: true, email: true } }
            }
        })

        // Map status to notification type
        const notificationTypeMap: Record<string, string> = {
            SHORTLISTED: "APPLICATION_SHORTLISTED",
            INTERVIEW: "APPLICATION_INTERVIEW",
            HIRED: "APPLICATION_HIRED",
            REJECTED: "APPLICATION_REJECTED",
        };

        const notificationType = notificationTypeMap[payload.status];
        if (notificationType) {
            await tx.notification.create({
                data: {
                    userId: application.user.id,
                    type: notificationType as "APPLICATION_SHORTLISTED" | "APPLICATION_INTERVIEW" | "APPLICATION_HIRED" | "APPLICATION_REJECTED",
                    title: `Application ${payload.status.toLowerCase()}`,
                    message: `Your application for "${application.job.title}" has been ${payload.status.toLowerCase()}.`,
                    metadata: { applicationId, jobId: application.jobId },
                }
            })
        }

        return updated;
    })
    logger.update(`Application status updated → id: ${applicationId}, status: ${payload.status}`);

    // Send email notification (best-effort)
    const statusMessages: Record<string, string> = {
        SHORTLISTED: "Congratulations! You have been shortlisted.",
        INTERVIEW: `You have been scheduled for an interview${payload.interviewDate ? ` on ${new Date(payload.interviewDate).toLocaleDateString()}` : ""}.`,
        HIRED: "Congratulations! You have been hired!",
        REJECTED: "Unfortunately, your application was not selected at this time.",
    };

    sendEmail({
        to: application.user.email,
        subject: `Application Update - ${application.job.title}`,
        templateName: "applicationStatus",
        templateData: {
            name: application.user.name,
            jobTitle: application.job.title,
            companyName: application.job.recruiter.companyName,
            status: payload.status.toLowerCase(),
            message: statusMessages[payload.status] || "Your application status has been updated.",
        }
    }).catch(() => { /* email delivery is best-effort */ });

    return updatedApplication;
}

const getAllApplications = async (query?: IQueryParams) => {
    logger.read("Fetching all applications (admin)");
    const page = parseInt(query?.page || "1");
    const limit = parseInt(query?.limit || "20");
    const skip = (page - 1) * limit;

    const [applications, total] = await Promise.all([
        prisma.application.findMany({
            include: {
                user: {
                    select: { id: true, name: true, email: true, image: true }
                },
                job: {
                    include: {
                        recruiter: {
                            select: { id: true, name: true, companyName: true }
                        }
                    }
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.application.count(),
    ]);

    return {
        data: applications,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

export const ApplicationService = {
    applyJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus,
    getAllApplications,
}
