/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { Role } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { ICreateAdminPayload, ICreateRecruiterPayload } from "./user.interface";

const createRecruiter = async (payload: ICreateRecruiterPayload) => {
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

            // Create wallet with 50 free coins
            await tx.wallet.create({
                data: {
                    userId: userData.user.id,
                    balance: 50,
                    transactions: {
                        create: {
                            amount: 50,
                            type: "CREDIT",
                            purpose: "SUBSCRIPTION_PURCHASE",
                            details: "Welcome bonus - Free plan (50 coins)",
                        }
                    }
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

            return recruiter;
        })

        return result;
    } catch (error) {
        await prisma.user.delete({
            where: {
                id: userData.user.id
            }
        })
        throw error;
    }
}

const createAdmin = async (payload: ICreateAdminPayload) => {
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

            // Create wallet for admin
            await tx.wallet.create({
                data: {
                    userId: userData.user.id,
                    balance: 0,
                }
            })

            return adminData;
        })

        return result;

    } catch (error) {
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
