import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { IQueryParams } from "../../interfaces/query.interface";
import { prisma } from "../../lib/prisma";
import { getUserProfileCompletion } from "../../utils/profileCompletion";

const getMyResume = async (user: IRequestUser) => {
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId },
        include: {
            user: {
                select: { id: true, name: true, email: true, image: true }
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

    let resume;
    if (existingResume) {
        resume = await prisma.resume.update({
            where: { id: existingResume.id },
            data: payload,
            include: {
                user: {
                    select: { id: true, name: true, email: true, image: true }
                }
            }
        })
    } else {
        resume = await prisma.resume.create({
            data: {
                userId: user.userId,
                ...payload,
            } as Prisma.ResumeUncheckedCreateInput,
            include: {
                user: {
                    select: { id: true, name: true, email: true, image: true }
                }
            }
        })
    }

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
        where: { userId: user.userId }
    })

    if (!resume) {
        throw new AppError(status.BAD_REQUEST, "You must create a resume before checking your ATS score.");
    }

    const profileCompletion = getUserProfileCompletion(resume);

    // Base score from profile completion
    let score = profileCompletion;
    const suggestions: string[] = [];

    // Evaluate resume sections
    if (!resume.title) suggestions.push("Add a professional title to your resume.");
    if (!resume.summary) suggestions.push("Write a professional summary.");
    if (!resume.skills || resume.skills.length === 0) suggestions.push("Add your skills.");
    if (!resume.skills || resume.skills.length < 5) suggestions.push("Add at least 5 skills for better matching.");
    if (!resume.experience || (resume.experience as unknown[]).length === 0) suggestions.push("Add your work experience.");
    if (!resume.education || (resume.education as unknown[]).length === 0) suggestions.push("Add your education details.");
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

    // Free text search across title, summary, address
    if (searchTerm) {
        conditions.push({
            OR: [
                { title: { contains: searchTerm, mode: "insensitive" } },
                { summary: { contains: searchTerm, mode: "insensitive" } },
                { address: { contains: searchTerm, mode: "insensitive" } },
                { skills: { hasSome: [searchTerm] } },
            ]
        });
    }

    // Search by experience (JSON array path search via raw filter)
    if (experience) {
        conditions.push({
            experience: { isEmpty: false }
        });
    }

    // Search by education (JSON array path search)
    if (education) {
        conditions.push({
            education: { isEmpty: false }
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

export const ResumeService = {
    getMyResume,
    updateMyResume,
    getResumeByUserId,
    getAtsScore,
    searchCandidates,
}
