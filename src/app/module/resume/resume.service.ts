import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { IQueryParams } from "../../interfaces/query.interface";
import { prisma } from "../../lib/prisma";

/* eslint-disable @typescript-eslint/no-explicit-any */
const getMyResume = async (user: IRequestUser) => {
    const resume = await prisma.resume.findUnique({
        where: { userId: user.userId },
        include: {
            user: {
                select: { id: true, name: true, email: true, image: true }
            }
        }
    })

    return resume;
}

const updateMyResume = async (user: IRequestUser, payload: any) => {
    const existingResume = await prisma.resume.findUnique({
        where: { userId: user.userId }
    })

    if (payload.dateOfBirth) {
        payload.dateOfBirth = new Date(payload.dateOfBirth);
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
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true, image: true }
                }
            }
        })
    }

    return resume;
}

const getResumeByUserId = async (userId: string, requestUser: IRequestUser) => {
    // Only recruiters and admins can view other users' resumes
    if (requestUser.role !== "RECRUITER" && requestUser.role !== "ADMIN" && requestUser.role !== "SUPER_ADMIN") {
        throw new AppError(status.FORBIDDEN, "You are not authorized to view this resume");
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

    return resume;
}

const viewRecruiterEmail = async (user: IRequestUser, recruiterId: string) => {
    // Charge user 15 coins to view recruiter email
    const wallet = await prisma.wallet.findUnique({
        where: { userId: user.userId }
    })

    if (!wallet || wallet.balance < 15) {
        throw new AppError(status.BAD_REQUEST, "Insufficient coins. Viewing recruiter email costs 15 coins.");
    }

    const recruiter = await prisma.recruiter.findUnique({
        where: { id: recruiterId },
        include: { user: true }
    })

    if (!recruiter) {
        throw new AppError(status.NOT_FOUND, "Recruiter not found");
    }

    await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: 15 } }
        })

        await tx.coinTransaction.create({
            data: {
                walletId: wallet.id,
                amount: 15,
                type: "DEBIT",
                purpose: "VIEW_RECRUITER_EMAIL",
                details: `Viewed recruiter email: ${recruiter.companyName}`,
            }
        })

        await tx.notification.create({
            data: {
                userId: user.userId,
                type: "COIN_DEBITED",
                title: "Coins Deducted",
                message: `15 coins deducted for viewing recruiter email: ${recruiter.companyName}`,
                metadata: { coins: 15, recruiterId },
            }
        })
    })

    return { email: recruiter.email, companyName: recruiter.companyName };
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
    viewRecruiterEmail,
    searchCandidates,
}
