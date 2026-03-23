
import status from "http-status";
import { Role } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";
import { ICreateAdminPayload, ICreateRecruiterPayload } from "./user.interface";

const createRecruiter = async (payload: ICreateRecruiterPayload) => {
    logger.create(`Recruiter creation requested → email: ${payload.recruiter.email}`);
    const userExists = await prisma.user.findUnique({
        where: {
            email: payload.recruiter.email
        }
    })

    if (userExists) {
        throw new AppError(status.CONFLICT, "User with this email already exists");
    }

    const userData = await auth.api.signUpEmail({
        body: {
            email: payload.recruiter.email,
            password: payload.password,
            role: Role.RECRUITER,
            name: payload.recruiter.name,
            needPasswordChange: true,
        }
    })

    try {
        const result = await prisma.$transaction(async (tx) => {
            const recruiterData = await tx.recruiter.create({
                data: {
                    userId: userData.user.id,
                    ...payload.recruiter,
                }
            })



            const recruiter = await tx.recruiter.findUnique({
                where: {
                    id: recruiterData.id
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            role: true,
                            status: true,
                            emailVerified: true,
                            image: true,
                            isDeleted: true,
                            createdAt: true,
                            updatedAt: true,
                        }
                    },
                }
            })

            logger.create(`Recruiter created → id: ${recruiterData.id}`);
            return recruiter;
        })

        return result;
    } catch (error) {
        logger.error(`Failed to create recruiter → email: ${payload.recruiter.email}`, error);
        await prisma.user.delete({
            where: {
                id: userData.user.id
            }
        })
        throw error;
    }
}

const createAdmin = async (payload: ICreateAdminPayload) => {
    logger.create(`Admin creation requested → email: ${payload.admin.email}`);
    const userExists = await prisma.user.findUnique({
        where: {
            email: payload.admin.email
        }
    })

    if (userExists) {
        throw new AppError(status.CONFLICT, "User with this email already exists");
    }

    const { admin, role, password } = payload;

    const userData = await auth.api.signUpEmail({
        body: {
            ...admin,
            password,
            role,
            needPasswordChange: true,
        }
    })

    try {
        const result = await prisma.$transaction(async (tx) => {
            const adminData = await tx.admin.create({
                data: {
                    userId: userData.user.id,
                    ...admin,
                }
            })



            logger.create(`Admin created → id: ${adminData.id}`);
            return adminData;
        })

        return result;

    } catch (error) {
        logger.error(`Failed to create admin → email: ${payload.admin.email}`, error);
        await prisma.user.delete({
            where: {
                id: userData.user.id
            }
        })
        throw error;
    }
}

export const UserService = {
    createRecruiter,
    createAdmin,
}
