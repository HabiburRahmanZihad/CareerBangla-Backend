import status from "http-status";
import { Recruiter } from "../../../generated/prisma/client";
import { RecruiterStatus, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { IQueryParams } from "../../interfaces/query.interface";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { sendEmail } from "../../utils/email";
import { recruiterFilterableFields, recruiterSearchableFields } from "./recruiter.constant";
import { IUpdateRecruiterPayload } from "./recruiter.interface";
import { logger } from "../../utils/logger";

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

    return recruiter;
}

const getMyProfile = async (user: IRequestUser) => {
    logger.read(`Fetching recruiter profile → userId: ${user.userId}`);
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
    logger.update(`Recruiter approved → id: ${id}`);

    // Create notification for recruiter
    await prisma.notification.create({
        data: {
            userId: recruiter.userId,
            type: "RECRUITER_APPROVED",
            title: "Account Approved",
            message: "Your recruiter account has been approved. You can now post jobs and view candidates.",
        }
    })

    // Send email notification
    try {
        await sendEmail({
            to: recruiter.email,
            subject: "CareerBangla - Recruiter Account Approved",
            templateName: "applicationStatus",
            templateData: {
                name: recruiter.name,
                jobTitle: "Recruiter Account",
                companyName: "CareerBangla",
                status: "approved",
                message: "Your recruiter account has been approved! You can now post jobs and search for candidates on CareerBangla.",
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
