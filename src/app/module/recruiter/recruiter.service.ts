import status from "http-status";
import { Recruiter } from "../../../generated/prisma/client";
import { RecruiterStatus, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { cacheManager } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { sendEmail } from "../../utils/email";
import { logger } from "../../utils/logger";
import { recruiterFilterableFields, recruiterSearchableFields } from "./recruiter.constant";
import { IUpdateRecruiterPayload } from "./recruiter.interface";

const getAllRecruiters = async (query: IQueryParams) => {
    logger.read("Fetching all recruiters", { filters: query });
    const queryBuilder = new QueryBuilder<Recruiter>(
        prisma.recruiter,
        query,
        {
            searchableFields: recruiterSearchableFields,
            filterableFields: recruiterFilterableFields,
        }
    )

    const result = await queryBuilder
        .search()
        .filter()
        .where({ isDeleted: false })
        .include({ user: true, jobs: { where: { isDeleted: false } } })
        .paginate()
        .sort()
        .fields()
        .execute();

    return result;
}

const getRecruiterById = async (id: string) => {
    logger.read(`Fetching recruiter → id: ${id}`);

    // Try to get from cache first
    const cached = cacheManager.recruiter.get(id);
    if (cached) {
        logger.read(`✅ Recruiter loaded from cache → id: ${id}`);
        return cached;
    }

    const recruiter = await prisma.recruiter.findUnique({
        where: { id, isDeleted: false },
        include: {
            user: true,
            jobs: {
                where: { isDeleted: false },
                orderBy: { createdAt: "desc" },
            },
        }
    })

    if (!recruiter) {
        throw new AppError(status.NOT_FOUND, "Recruiter not found");
    }

    // Cache the recruiter with LONG TTL
    cacheManager.recruiter.set(id, recruiter);

    return recruiter;
}

const getMyProfile = async (user: IRequestUser) => {
    logger.read(`Fetching recruiter profile → userId: ${user.userId}`);

    // Try to get from cache using userId
    const cached = cacheManager.recruiter.getByUser(user.userId);
    if (cached) {
        logger.read(`✅ Recruiter profile loaded from cache → userId: ${user.userId}`);
        return cached;
    }

    const recruiter = await prisma.recruiter.findUnique({
        where: { userId: user.userId },
        include: {
            user: true,
            jobs: {
                where: { isDeleted: false },
                orderBy: { createdAt: "desc" },
                include: {
                    applications: true,
                }
            },
        }
    })

    if (!recruiter) {
        throw new AppError(status.NOT_FOUND, "Recruiter profile not found");
    }

    // Cache the recruiter profile
    cacheManager.recruiter.setByUser(user.userId, recruiter);

    return recruiter;
}

const updateRecruiter = async (id: string, payload: IUpdateRecruiterPayload) => {
    logger.update(`Recruiter update requested → id: ${id}`);
    const isRecruiterExist = await prisma.recruiter.findUnique({
        where: { id }
    })

    if (!isRecruiterExist) {
        throw new AppError(status.NOT_FOUND, "Recruiter not found");
    }

    const { recruiter } = payload;

    const updatedRecruiter = await prisma.recruiter.update({
        where: { id },
        data: { ...recruiter },
        include: { user: true },
    })
    logger.update(`Recruiter updated → id: ${id}`);

    // Invalidate cache for this recruiter
    cacheManager.invalidate.recruiterUpdated(id, updatedRecruiter.userId);

    return updatedRecruiter;
}

const updateMyProfile = async (user: IRequestUser, payload: IUpdateRecruiterPayload) => {
    logger.update(`Recruiter self-update → userId: ${user.userId}`);
    const recruiter = await prisma.recruiter.findUnique({
        where: { userId: user.userId }
    })

    if (!recruiter) {
        throw new AppError(status.NOT_FOUND, "Recruiter profile not found");
    }

    const updatedRecruiter = await prisma.recruiter.update({
        where: { id: recruiter.id },
        data: { ...payload.recruiter },
        include: { user: true },
    })
    logger.update(`Recruiter profile updated → userId: ${user.userId}`);

    return updatedRecruiter;
}

const deleteRecruiter = async (id: string) => {
    logger.delete(`Recruiter delete requested → id: ${id}`);
    const isRecruiterExist = await prisma.recruiter.findUnique({
        where: { id },
        include: { user: true }
    })

    if (!isRecruiterExist) {
        throw new AppError(status.NOT_FOUND, "Recruiter not found");
    }

    await prisma.$transaction(async (tx) => {
        await tx.recruiter.update({
            where: { id },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
            },
        })

        await tx.user.update({
            where: { id: isRecruiterExist.userId },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                status: UserStatus.DELETED
            },
        })

        await tx.session.deleteMany({
            where: { userId: isRecruiterExist.userId }
        })
    })
    logger.delete(`Recruiter deleted → id: ${id}`);

    return { message: "Recruiter deleted successfully" };
}

const approveRecruiter = async (id: string) => {
    logger.update(`Recruiter approval requested → id: ${id}`);
    const recruiter = await prisma.recruiter.findUnique({
        where: { id },
        include: { user: true }
    })

    if (!recruiter) {
        throw new AppError(status.NOT_FOUND, "Recruiter not found");
    }

    if (recruiter.status === RecruiterStatus.APPROVED) {
        throw new AppError(status.BAD_REQUEST, "Recruiter is already approved");
    }

    const updatedRecruiter = await prisma.recruiter.update({
        where: { id },
        data: { status: RecruiterStatus.APPROVED },
        include: { user: true },
    })

    // Mark email as verified in the user profile
    await prisma.user.update({
        where: { id: recruiter.userId },
        data: { emailVerified: true }
    })

    logger.update(`Recruiter approved → id: ${id}`);

    // Create notification for recruiter
    await prisma.notification.create({
        data: {
            userId: recruiter.userId,
            type: "RECRUITER_APPROVED",
            title: "Account Verified",
            message: "Your recruiter account has been verified! You can now log in and start posting jobs.",
        }
    })

    // Send email notification
    try {
        await sendEmail({
            to: recruiter.email,
            subject: "Your CareerBangla Recruiter Account Has Been Verified",
            templateName: "accountVerified",
            templateData: {
                name: recruiter.name,
                email: recruiter.email,
                loginUrl: "https://careerbangla.com/login",
                message: "Your recruiter account has been verified by our admin team! You can now log in to CareerBangla and start posting jobs, searching for candidates, and managing your company information.",
            }
        })
    } catch {
        /* email delivery is best-effort */
    }

    return updatedRecruiter;
}

const rejectRecruiter = async (id: string) => {
    logger.update(`Recruiter rejection requested → id: ${id}`);
    const recruiter = await prisma.recruiter.findUnique({
        where: { id },
        include: { user: true }
    })

    if (!recruiter) {
        throw new AppError(status.NOT_FOUND, "Recruiter not found");
    }

    const updatedRecruiter = await prisma.recruiter.update({
        where: { id },
        data: { status: RecruiterStatus.REJECTED },
        include: { user: true },
    })
    logger.update(`Recruiter rejected → id: ${id}`);

    await prisma.notification.create({
        data: {
            userId: recruiter.userId,
            type: "RECRUITER_REJECTED",
            title: "Account Rejected",
            message: "Your recruiter account application has been rejected. Please contact support for more information.",
        }
    })

    // Send email notification
    try {
        await sendEmail({
            to: recruiter.email,
            subject: "CareerBangla - Recruiter Account Update",
            templateName: "applicationStatus",
            templateData: {
                name: recruiter.name,
                jobTitle: "Recruiter Account",
                companyName: "CareerBangla",
                status: "rejected",
                message: "Your recruiter account application has been rejected. Please contact support for more information.",
            }
        })
    } catch {
        /* email delivery is best-effort */
    }

    return updatedRecruiter;
}

const viewRecruiterEmail = async (user: IRequestUser, recruiterId: string) => {
    logger.read(`Viewing recruiter email → recruiterId: ${recruiterId}`);
    const recruiter = await prisma.recruiter.findUnique({
        where: { id: recruiterId },
        include: { user: true }
    })

    if (!recruiter) {
        throw new AppError(status.NOT_FOUND, "Recruiter not found");
    }

    return { email: recruiter.email, companyName: recruiter.companyName };
}

export const RecruiterService = {
    getAllRecruiters,
    getRecruiterById,
    getMyProfile,
    updateRecruiter,
    updateMyProfile,
    deleteRecruiter,
    approveRecruiter,
    rejectRecruiter,
    viewRecruiterEmail,
}
