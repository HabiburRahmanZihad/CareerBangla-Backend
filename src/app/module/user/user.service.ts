
import status from "http-status";
import { Role } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
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

const createAdmin = async (payload: ICreateAdminPayload, authenticatedUser?: any) => {
    logger.create(`Admin creation requested → email: ${payload.admin.email}`);

    // Authorization: Only SUPER_ADMIN can create admins
    if (!authenticatedUser || authenticatedUser.role !== Role.SUPER_ADMIN) {
        throw new AppError(
            status.FORBIDDEN,
            "Only Super Admin can create admin accounts"
        );
    }

    // Security: Force role to ADMIN (prevent privilege escalation)
    const { admin, password } = payload;
    const role = Role.ADMIN;

    const userExists = await prisma.user.findUnique({
        where: {
            email: payload.admin.email
        }
    })

    if (userExists) {
        throw new AppError(status.CONFLICT, "User with this email already exists");
    }

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

            // Send welcome email
            try {
                await sendEmail({
                    to: admin.email,
                    subject: "CareerBangla - Welcome Admin",
                    templateName: "applicationStatus",
                    templateData: {
                        name: admin.name,
                        jobTitle: "Admin Account",
                        companyName: "CareerBangla",
                        status: "approved",
                        message: `Your admin account has been created on CareerBangla. You can login with your email (${admin.email}) and the temporary password provided. Please change your password after first login.`,
                    }
                });
            } catch {
                /* email delivery is best-effort */
            }

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
