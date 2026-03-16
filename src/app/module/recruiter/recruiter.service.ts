import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { RecruiterStatus, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { IQueryParams } from "../../interfaces/query.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { recruiterFilterableFields, recruiterSearchableFields } from "./recruiter.constant";
import { IUpdateRecruiterPayload } from "./recruiter.interface";

const getAllRecruiters = async (query: IQueryParams) => {
    const queryBuilder = new QueryBuilder<Prisma.RecruiterWhereInput>(
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

    return updatedRecruiter;
}

const updateMyProfile = async (user: IRequestUser, payload: IUpdateRecruiterPayload) => {
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

    return updatedRecruiter;
}

const deleteRecruiter = async (id: string) => {
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

    return { message: "Recruiter deleted successfully" };
}

const approveRecruiter = async (id: string) => {
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

    // Create notification for recruiter
    await prisma.notification.create({
        data: {
            userId: recruiter.userId,
            type: "RECRUITER_APPROVED",
            title: "Account Approved",
            message: "Your recruiter account has been approved. You can now post jobs and view candidates.",
        }
    })

    return updatedRecruiter;
}

const rejectRecruiter = async (id: string) => {
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

    await prisma.notification.create({
        data: {
            userId: recruiter.userId,
            type: "RECRUITER_REJECTED",
            title: "Account Rejected",
            message: "Your recruiter account application has been rejected. Please contact support for more information.",
        }
    })

    return updatedRecruiter;
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
}
