import status from "http-status";
import { ApplicationStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import { logger } from "../../utils/logger";
import { getUserProfileCompletion } from "../../utils/profileCompletion";
import { ResumeService } from "../resume/resume.service";

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

    // All validations passed — create application
    const application = await prisma.application.create({
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
    logger.create(`Job application created → id: ${application.id}, jobId: ${jobId}`);

    // Create notification for recruiter
    await prisma.notification.create({
        data: {
            userId: job.recruiter.userId,
            type: "APPLICATION_SUBMITTED",
            title: "New Application Received",
            message: `${user.email} applied for "${job.title}"`,
            metadata: { applicationId: application.id, jobId: job.id },
        }
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
            const recruiterUser = await prisma.user.findUnique({
                where: { id: job.recruiter.userId },
                select: { email: true, isPremium: true, premiumUntil: true },
            });
            if (!recruiterUser) return;

            const recruiterIsPremium = recruiterUser.isPremium &&
                (!recruiterUser.premiumUntil || new Date(recruiterUser.premiumUntil) > new Date());

            // Get applicant resume for contact info
            const applicantResume = await prisma.resume.findUnique({
                where: { userId: user.userId },
                select: { contactNumber: true },
            });

            // Generate CV PDF if applicant is premium (has paid for Career Boost)
            const applicantUser = await prisma.user.findUnique({
                where: { id: user.userId },
                select: { isPremium: true, premiumUntil: true },
            });
            const applicantIsPremium = applicantUser?.isPremium &&
                (!applicantUser.premiumUntil || new Date(applicantUser.premiumUntil) > new Date());

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

const getMyApplications = async (user: IRequestUser) => {
    logger.read(`Fetching user applications → userId: ${user.userId}`);
    const applications = await prisma.application.findMany({
        where: { userId: user.userId },
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
    })

    return applications;
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
    const isPremiumRecruiter = recruiterUser?.isPremium &&
        (!recruiterUser.premiumUntil || new Date(recruiterUser.premiumUntil) > new Date());

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

const getAllApplications = async () => {
    logger.read("Fetching all applications (admin)");
    const applications = await prisma.application.findMany({
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
    })

    return applications;
}

export const ApplicationService = {
    applyJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus,
    getAllApplications,
}
