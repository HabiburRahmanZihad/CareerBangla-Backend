import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
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
    })

    return { email: recruiter.email, companyName: recruiter.companyName };
}

export const ResumeService = {
    getMyResume,
    updateMyResume,
    getResumeByUserId,
    viewRecruiterEmail,
}
