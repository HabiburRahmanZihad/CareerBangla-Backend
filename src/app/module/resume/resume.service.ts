import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { getUserProfileCompletion } from "../../utils/profileCompletion";

const getMyResume = async (user: IRequestUser) => {
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId },
        include: {
            user: {
                select: { id: true, name: true, email: true, image: true }
            },
            workExperience: {
                orderBy: { createdAt: 'desc' }
            },
            education: {
                orderBy: { createdAt: 'desc' }
            },
            certifications: {
                orderBy: { createdAt: 'desc' }
            },
            projects: {
                orderBy: { createdAt: 'desc' }
            },
            languages: {
                orderBy: { createdAt: 'desc' }
            },
            awards: {
                orderBy: { createdAt: 'desc' }
            },
            references: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    const profileCompletion = getUserProfileCompletion(resume);

    return {
        ...resume,
        profileCompletion,
    };
}

const updateMyResume = async (user: IRequestUser, payload: Prisma.ResumeUpdateInput) => {
    const existingResume = await prisma.resume.findUnique({
        where: { userId: user.userId }
    })

    if (payload.dateOfBirth) {
        payload.dateOfBirth = new Date(payload.dateOfBirth as string);
    }

    const buildPayload = (isUpdate: boolean) => {
        const p = { ...payload } as any;

        const mapRel = (fieldArray: any) => {
            if (Array.isArray(fieldArray)) {
                const mapped = {
                    create: fieldArray.map((item) => {
                        const { id, resumeId, createdAt, updatedAt, ...rest } = item;
                        return rest;
                    })
                };
                if (isUpdate) (mapped as any).deleteMany = {};
                return mapped;
            }
            return undefined;
        };

        if (p.workExperience !== undefined) p.workExperience = mapRel(p.workExperience);
        if (p.education !== undefined) p.education = mapRel(p.education);
        if (p.certifications !== undefined) p.certifications = mapRel(p.certifications);

        return p;
    };

    const resumeInclude = {
        user: { select: { id: true, name: true, email: true, image: true } },
        workExperience: { orderBy: { createdAt: 'desc' as const } },
        education: { orderBy: { createdAt: 'desc' as const } },
        certifications: { orderBy: { createdAt: 'desc' as const } },
        projects: { orderBy: { createdAt: 'desc' as const } },
        languages: { orderBy: { createdAt: 'desc' as const } },
        awards: { orderBy: { createdAt: 'desc' as const } },
        references: { orderBy: { createdAt: 'desc' as const } }
    };

    if (existingResume?.profileCompletedAt) {
        const wallet = await prisma.wallet.findUnique({ where: { userId: user.userId } });

        if (!wallet || wallet.balance < 15) {
            throw new AppError(status.BAD_REQUEST, "Insufficient coins. Updating your profile costs 15 coins after initial completion.");
        }

        const resume = await prisma.$transaction(async (tx) => {
            await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: 15 } }
            });

            await tx.coinTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount: 15,
                    type: "DEBIT",
                    purpose: "PROFILE_UPDATE",
                    details: "Profile update after initial completion",
                }
            });

            await tx.notification.create({
                data: {
                    userId: user.userId,
                    type: "COIN_DEBITED",
                    title: "Coins Deducted",
                    message: "15 coins deducted for profile update",
                    metadata: { coins: 15, reason: "PROFILE_UPDATE" },
                }
            });

            return await tx.resume.update({
                where: { id: existingResume.id },
                data: buildPayload(true),
                include: resumeInclude,
            });
        });

        const profileCompletion = getUserProfileCompletion(resume);
        return { ...resume, profileCompletion };
    }

    const resume = await prisma.$transaction(async (tx) => {
        let result;
        if (existingResume) {
            result = await tx.resume.update({
                where: { id: existingResume.id },
                data: buildPayload(true),
                include: resumeInclude,
            });
        } else {
            result = await tx.resume.create({
                data: {
                    userId: user.userId,
                    ...buildPayload(false),
                },
                include: resumeInclude,
            });
        }

        const completion = getUserProfileCompletion(result);

        if (completion === 100 && !result.profileCompletedAt) {
            result = await tx.resume.update({
                where: { id: result.id },
                data: { profileCompletedAt: new Date() },
                include: resumeInclude,
            });
        }

        return result;
    });

    const profileCompletion = getUserProfileCompletion(resume);

    return {
        ...resume,
        profileCompletion,
    };
}

const getResumeByUserId = async (userId: string, requestUser: IRequestUser) => {
    // Only recruiters and admins can view other users' resumes
    if (requestUser.role !== "RECRUITER" && requestUser.role !== "ADMIN" && requestUser.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "You are not authorized to view this resume");
    }

    // Validate resume exists BEFORE charging coins
    const resume = await prisma.resume.findUnique({
        where: { userId },
        include: {
            user: {
                select: { id: true, name: true, email: true, image: true }
            },
            workExperience: {
                orderBy: { createdAt: 'desc' }
            },
            education: {
                orderBy: { createdAt: 'desc' }
            },
            certifications: {
                orderBy: { createdAt: 'desc' }
            },
            projects: {
                orderBy: { createdAt: 'desc' }
            },
            languages: {
                orderBy: { createdAt: 'desc' }
            },
            awards: {
                orderBy: { createdAt: 'desc' }
            },
            references: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!resume) {
        throw new AppError(status.NOT_FOUND, "Resume not found");
    }

    // If recruiter, charge 10 coins to view candidate
    if (requestUser.role === "RECRUITER") {
        const wallet = await prisma.wallet.findUnique({
            where: { userId: requestUser.userId }
        })

        if (!wallet || wallet.balance < 10) {
            throw new AppError(status.BAD_REQUEST, "Insufficient coins. Viewing a candidate costs 10 coins.");
        }

        await prisma.$transaction(async (tx) => {
            await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: 10 } }
            })

            await tx.coinTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount: 10,
                    type: "DEBIT",
                    purpose: "VIEW_CANDIDATE",
                    details: `Viewed candidate resume: ${userId}`,
                }
            })

            await tx.notification.create({
                data: {
                    userId: requestUser.userId,
                    type: "COIN_DEBITED",
                    title: "Coins Deducted",
                    message: `10 coins deducted for viewing candidate profile`,
                    metadata: { coins: 10, candidateUserId: userId },
                }
            })
        })
    }

    return resume;
}

const getAtsScore = async (user: IRequestUser, jobId?: string) => {
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId },
        include: {
            workExperience: true,
            education: true,
        }
    })

    if (!resume) {
        throw new AppError(status.BAD_REQUEST, "You must create a resume before checking your ATS score.");
    }

    const profileCompletion = getUserProfileCompletion(resume);

    // Base score from profile completion
    const score = profileCompletion;
    const suggestions: string[] = [];

    // Evaluate resume sections
    if (!resume.professionalTitle) suggestions.push("Add a professional title to your resume.");
    if (!resume.professionalSummary) suggestions.push("Write a professional summary.");
    if (!resume.technicalSkills || resume.technicalSkills.length === 0) suggestions.push("Add your skills.");
    if (!resume.technicalSkills || resume.technicalSkills.length < 5) suggestions.push("Add at least 5 skills for better matching.");

    if (resume.workExperience.length === 0) suggestions.push("Add your work experience.");

    if (resume.education.length === 0) suggestions.push("Add your education details.");

    if (!resume.contactNumber) suggestions.push("Add your contact number.");
    if (!resume.address) suggestions.push("Add your address.");
    if (!resume.linkedinUrl) suggestions.push("Add your LinkedIn profile URL.");

    // If jobId provided, match against job requirements
    let jobMatchScore: number | null = null;
    let matchedSkills: string[] = [];
    let missingSkills: string[] = [];

    if (jobId) {
        const job = await prisma.job.findUnique({
            where: { id: jobId, isDeleted: false }
        })

        if (job && job.skills && resume.skills) {
            const jobSkillsLower = job.skills.map(s => s.toLowerCase());
            const resumeSkillsLower = resume.skills.map(s => s.toLowerCase());

            matchedSkills = resume.skills.filter(s => jobSkillsLower.includes(s.toLowerCase()));
            missingSkills = job.skills.filter(s => !resumeSkillsLower.includes(s.toLowerCase()));

            jobMatchScore = jobSkillsLower.length > 0
                ? Math.round((matchedSkills.length / jobSkillsLower.length) * 100)
                : 100;

            if (missingSkills.length > 0) {
                suggestions.push(`Consider adding these skills to match the job: ${missingSkills.join(", ")}`);
            }
        }
    }

    return {
        atsScore: score,
        profileCompletion,
        suggestions,
        ...(jobId ? { jobMatchScore, matchedSkills, missingSkills } : {}),
    };
}

const searchCandidates = async (user: IRequestUser, query: IQueryParams) => {
    if (user.role !== "RECRUITER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "Only recruiters and admins can search candidates");
    }

    const { searchTerm, skills, experience, location, education, page = "1", limit = "10" } = query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ResumeWhereInput = {};
    const conditions: Prisma.ResumeWhereInput[] = [];

    // Search by skills (array contains)
    if (skills) {
        const skillList = skills.split(",").map(s => s.trim());
        conditions.push({
            skills: { hasSome: skillList }
        });
    }

    // Search by location (address field)
    if (location) {
        conditions.push({
            address: { contains: location, mode: "insensitive" }
        });
    }

    // Free text search across professional title, summary, and address
    if (searchTerm) {
        conditions.push({
            OR: [
                { professionalTitle: { contains: searchTerm, mode: "insensitive" } },
                { professionalSummary: { contains: searchTerm, mode: "insensitive" } },
                { address: { contains: searchTerm, mode: "insensitive" } },
                { technicalSkills: { hasSome: [searchTerm] } },
                { softSkills: { hasSome: [searchTerm] } },
            ]
        });
    }

    // Search by work experience
    if (experience) {
        conditions.push({
            workExperience: { some: {} }
        });
    }

    // Search by education (relation filter)
    if (education) {
        conditions.push({
            education: { some: {} }
        });
    }

    if (conditions.length > 0) {
        where.AND = conditions;
    }

    const [candidates, total] = await Promise.all([
        prisma.resume.findMany({
            where,
            include: {
                user: {
                    select: { id: true, name: true, image: true }
                }
            },
            skip,
            take: limitNum,
            orderBy: { updatedAt: "desc" },
        }),
        prisma.resume.count({ where }),
    ]);

    return {
        data: candidates,
        meta: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        }
    };
}

const deleteMyResume = async (user: IRequestUser) => {
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId },
    });

    if (!resume) {
        throw new AppError(status.NOT_FOUND, "Resume not found");
    }

    await prisma.resume.delete({
        where: { id: resume.id },
    });

    return null;
}

export const ResumeService = {
    getMyResume,
    updateMyResume,
    getResumeByUserId,
    getAtsScore,
    searchCandidates,
    deleteMyResume,

}