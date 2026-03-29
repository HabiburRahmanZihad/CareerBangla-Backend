import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { ApplicationStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import { logger } from "../../utils/logger";
import { hasActivePremium } from "../../utils/premium";
import { getUserProfileCompletion } from "../../utils/profileCompletion";
import { ResumeService } from "../resume/resume.service";

const applyJob = async (user: IRequestUser, payload: { jobId: string; coverLetter?: string }) => {
    const { jobId, coverLetter } = payload;
    logger.create(`Job application requested → userId: ${user.userId}, jobId: ${jobId}`);

    // Check if user has completed their resume/ATS profile before applying
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId },
        include: {
            workExperience: true,
            education: true,
            certifications: true,
            projects: true,
            languages: true,
            awards: true,
            references: true,
        }
    })

    if (!resume) {
        throw new AppError(status.BAD_REQUEST, "You must complete your ATS resume profile before applying for jobs. Go to your profile and fill in your resume.");
    }

    // Check profile completion >= 60%
    const profileCompletion = getUserProfileCompletion(resume);
    if (profileCompletion < 60) {
        throw new AppError(status.BAD_REQUEST, `Your profile is ${profileCompletion}% complete. You must complete at least 60% of your profile before applying for jobs.`);
    }

    const job = await prisma.job.findUnique({
        where: { id: jobId, isDeleted: false, status: "LIVE" },
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
    const application = await prisma.$transaction(async (tx) => {
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
    payload: { status: ApplicationStatus; interviewDate?: string; interviewNote?: string; hiredCompany?: string; hiredDesignation?: string }
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

    // Validate application status lifecycle transitions (role-based)
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

    // Recruiters can only move forward: PENDING → SHORTLISTED → INTERVIEW (no reverting, no HIRED/REJECTED)
    const recruiterTransitions: Record<string, ApplicationStatus[]> = {
        PENDING: [ApplicationStatus.SHORTLISTED],
        SHORTLISTED: [ApplicationStatus.INTERVIEW],
        INTERVIEW: [],
        HIRED: [],
        REJECTED: [],
    };

    // Admins handle final verification: can set HIRED or REJECTED from INTERVIEW/SHORTLISTED
    const adminTransitions: Record<string, ApplicationStatus[]> = {
        PENDING: [ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED],
        SHORTLISTED: [ApplicationStatus.INTERVIEW, ApplicationStatus.HIRED, ApplicationStatus.REJECTED],
        INTERVIEW: [ApplicationStatus.HIRED, ApplicationStatus.REJECTED],
        HIRED: [],
        REJECTED: [],
    };

    const validTransitions = isAdmin ? adminTransitions : recruiterTransitions;
    const allowedNextStatuses = validTransitions[application.status];

    if (!allowedNextStatuses || !allowedNextStatuses.includes(payload.status)) {
        const roleLabel = isAdmin ? "Admin" : "Recruiter";
        throw new AppError(
            status.BAD_REQUEST,
            `${roleLabel} cannot transition from ${application.status} to ${payload.status}. Allowed transitions: ${allowedNextStatuses?.join(", ") || "none"}`
        );
    }

    const updateData: { status: ApplicationStatus; interviewDate?: Date; interviewNote?: string; hiredDate?: Date; hiredCompany?: string; hiredDesignation?: string } = {
        status: payload.status,
    };

    if (payload.interviewDate) {
        updateData.interviewDate = new Date(payload.interviewDate);
    }
    if (payload.interviewNote) {
        updateData.interviewNote = payload.interviewNote;
    }
    if (payload.status === ApplicationStatus.HIRED) {
        updateData.hiredDate = new Date();
        if (payload.hiredCompany) {
            updateData.hiredCompany = payload.hiredCompany;
        }
        if (payload.hiredDesignation) {
            updateData.hiredDesignation = payload.hiredDesignation;
        }
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

    const templateData: {
        name: string;
        jobTitle: string;
        companyName: string;
        status: string;
        message: string;
        interviewDate?: string;
        interviewNote?: string;
        hiredCompany?: string;
        hiredDesignation?: string;
        hiredDate?: string;
    } = {
        name: application.user.name,
        jobTitle: application.job.title,
        companyName: application.job.recruiter.companyName,
        status: payload.status.toLowerCase(),
        message: statusMessages[payload.status] || "Your application status has been updated.",
    };

    // Add interview details if scheduling interview
    if (payload.status === ApplicationStatus.INTERVIEW) {
        templateData.interviewDate = payload.interviewDate ? new Date(payload.interviewDate).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }) : "Date to be confirmed";
        templateData.interviewNote = payload.interviewNote || "";
    }

    // Add hired details if marking as hired
    if (payload.status === ApplicationStatus.HIRED) {
        templateData.hiredCompany = payload.hiredCompany || "";
        templateData.hiredDesignation = payload.hiredDesignation || "";
        templateData.hiredDate = new Date().toLocaleDateString();
    }

    sendEmail({
        to: application.user.email,
        subject: `Application Update - ${application.job.title}`,
        templateName: "applicationStatus",
        templateData,
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

// Get applicants for a specific job with detailed filtering
const getApplicantsForJob = async (
    user: IRequestUser,
    jobId: string,
    query?: {
        search?: string;
        skills?: string;
        education?: string;
        status?: string;
        page?: string;
        limit?: string;
    }
) => {
    logger.read(`Fetching applicants for job → jobId: ${jobId}, userId: ${user.userId}`);

    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { recruiter: true }
    })

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found");
    }

    // Only recruiter who posted the job or admin can view
    if (job.recruiter.userId !== user.userId && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "You are not authorized to view these applications");
    }

    // Check recruiter premium status
    const recruiterUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isPremium: true, premiumUntil: true },
    });
    const isPremiumRecruiter = recruiterUser ? hasActivePremium(recruiterUser) : false;

    const page = parseInt(query?.page || "1");
    const limit = parseInt(query?.limit || "20");
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: Record<string, unknown> = { jobId };

    if (query?.search) {
        whereClause.user = {
            OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } }
            ]
        };
    }

    if (query?.status) {
        whereClause.status = query.status;
    }

    // Get applications
    let applications = await prisma.application.findMany({
        where: whereClause,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: isPremiumRecruiter,
                    image: true,
                    resume: {
                        select: {
                            id: true,
                            skills: true,
                            technicalSkills: true,
                            softSkills: true,
                            toolsAndTechnologies: true,
                            education: true,
                            workExperience: true,
                            certifications: true,
                            projects: true,
                            languages: true,
                            awards: true,
                            professionalSummary: true,
                            profilePhoto: true,
                            nationality: true,
                            address: true,
                            linkedinUrl: true,
                            githubUrl: true,
                            portfolioUrl: true,
                            websiteUrl: true,
                            contactNumber: isPremiumRecruiter,
                            professionalTitle: true,
                        }
                    }
                }
            },
            job: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
    })

    // Filter by skills and education if provided
    if (query?.skills || query?.education) {
        applications = applications.filter(app => {
            const resume = app.user.resume;
            if (!resume) return false;

            if (query.skills) {
                const skills = resume.skills || [];
                const searchSkills = query.skills.split(",").map(s => s.toLowerCase().trim());
                const hasSkill = searchSkills.some(searchSkill =>
                    skills.some(skill => skill.toLowerCase().includes(searchSkill))
                );
                if (!hasSkill) return false;
            }

            if (query.education) {
                const educations = resume.education || [];
                const educationFilter = query.education.toLowerCase();
                const hasEducation = educations.some(edu =>
                (edu.degree?.toLowerCase().includes(educationFilter) ||
                    edu.fieldOfStudy?.toLowerCase().includes(educationFilter) ||
                    edu.institutionName?.toLowerCase().includes(educationFilter))
                );
                if (!hasEducation) return false;
            }

            return true;
        });
    }

    const total = applications.length;

    return {
        data: applications.slice(0, limit),
        isPremiumRecruiter,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

// Get all users directory for recruiters with filters and search
const getUserDirectory = async (
    user: IRequestUser,
    query?: {
        search?: string;
        skills?: string;
        education?: string;
        page?: string;
        limit?: string;
    }
) => {
    logger.read(`Fetching user directory → userId: ${user.userId}`);

    // Only recruiters can view user directory
    if (user.role !== "RECRUITER") {
        throw new AppError(status.FORBIDDEN, "Only recruiters can access the user directory");
    }

    // Check recruiter premium status
    const recruiterUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { isPremium: true, premiumUntil: true },
    });
    const isPremiumRecruiter = recruiterUser ? hasActivePremium(recruiterUser) : false;

    const page = parseInt(query?.page || "1");
    const limit = parseInt(query?.limit || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: Prisma.UserWhereInput = { role: "USER", isDeleted: false };

    if (query?.search) {
        whereClause.OR = [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } }
        ];
    }

    // Get users
    let users = await prisma.user.findMany({
        where: whereClause,
        include: {
            resume: {
                select: {
                    id: true,
                    skills: true,
                    technicalSkills: true,
                    softSkills: true,
                    toolsAndTechnologies: true,
                    education: true,
                    professionalTitle: true,
                    profilePhoto: true,
                    contactNumber: isPremiumRecruiter,
                }
            }
        },
        orderBy: { createdAt: "desc" },
    })

    // Filter by skills and education
    if (query?.skills || query?.education) {
        users = users.filter(u => {
            const resume = u.resume;
            if (!resume) return false;

            if (query.skills) {
                const skills = [
                    ...(resume.skills || []),
                    ...(resume.technicalSkills || []),
                    ...(resume.softSkills || []),
                    ...(resume.toolsAndTechnologies || []),
                ];
                const searchSkills = query.skills.split(",").map(s => s.toLowerCase().trim());
                const hasSkill = searchSkills.some(searchSkill =>
                    skills.some(skill => skill.toLowerCase().includes(searchSkill))
                );
                if (!hasSkill) return false;
            }

            if (query.education) {
                const educations = resume.education || [];
                const educationFilter = query.education.toLowerCase();
                const hasEducation = educations.some(edu =>
                (edu.degree?.toLowerCase().includes(educationFilter) ||
                    edu.fieldOfStudy?.toLowerCase().includes(educationFilter) ||
                    edu.institutionName?.toLowerCase().includes(educationFilter))
                );
                if (!hasEducation) return false;
            }

            return true;
        });
    }

    const total = users.length;
    const paginatedUsers = users.slice(skip, skip + limit);

    return {
        data: paginatedUsers,
        isPremiumRecruiter,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

const getHiredCandidates = async (user: IRequestUser | undefined, query?: IQueryParams & { recruiterId?: string; jobId?: string }) => {
    const page = query?.page ? parseInt(query.page as string, 10) : 1;
    const limit = query?.limit ? parseInt(query.limit as string, 10) : 10;
    const skip = (page - 1) * limit;

    const whereCondition: Prisma.ApplicationWhereInput = {
        status: ApplicationStatus.HIRED,
    };

    // If recruiter is viewing, filter by their jobs
    if (user && user.role === "RECRUITER") {
        whereCondition.job = {
            recruiter: {
                userId: user.userId
            }
        };
    }

    // Filter by specific recruiter if provided
    if (query?.recruiterId) {
        whereCondition.job = {
            recruiter: {
                id: query.recruiterId as string
            }
        };
    }

    // Filter by specific job if provided
    if (query?.jobId) {
        whereCondition.jobId = query.jobId as string;
    }

    const applications = await prisma.application.findMany({
        where: whereCondition,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    resume: {
                        select: {
                            professionalTitle: true,
                            profilePhoto: true,
                            contactNumber: true,
                        }
                    }
                }
            },
            job: {
                select: {
                    id: true,
                    title: true,
                    recruiter: {
                        select: {
                            id: true,
                            userId: true,
                            companyName: true,
                        }
                    }
                }
            }
        },
        orderBy: { hiredDate: Prisma.SortOrder.desc },
        skip,
        take: limit,
    });

    const total = await prisma.application.count({ where: whereCondition });

    return {
        data: applications,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        }
    };
}

const checkIfApplied = async (user: IRequestUser, jobId: string) => {
    const existing = await prisma.application.findUnique({
        where: { userId_jobId: { userId: user.userId, jobId } },
        select: { id: true, status: true, createdAt: true },
    });
    return { hasApplied: !!existing, application: existing ?? null };
};

export const ApplicationService = {
    applyJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus,
    getAllApplications,
    getApplicantsForJob,
    getUserDirectory,
    getHiredCandidates,
    checkIfApplied,
}
