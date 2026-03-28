/* eslint-disable @typescript-eslint/no-explicit-any */

import status from "http-status";
import { Role } from "../../../generated/prisma/client";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import { logger } from "../../utils/logger";
import { ICreateAdminPayload, ICreateRecruiterPayload } from "./user.interface";

const BD_PHONE_REGEX = /^01\d{9}$/;

const createRecruiter = async (payload: ICreateRecruiterPayload) => {
    logger.create(`Recruiter creation requested → email: ${payload.recruiter.email}`);

    // Validate phone format if provided
    if (payload.recruiter.contactNumber && !BD_PHONE_REGEX.test(payload.recruiter.contactNumber)) {
        throw new AppError(status.BAD_REQUEST, "Enter a valid 11-digit Bangladeshi phone number starting with 01");
    }

    // Check phone uniqueness if provided
    if (payload.recruiter.contactNumber) {
        const existingPhone = await prisma.user.findUnique({
            where: { phone: payload.recruiter.contactNumber },
            select: { id: true }
        });
        if (existingPhone) {
            throw new AppError(status.BAD_REQUEST, "Phone number is already registered");
        }
    }

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
            needPasswordChange: false,
        }
    })

    try {
        const result = await prisma.$transaction(async (tx) => {
            // Update user with phone number if provided
            if (payload.recruiter.contactNumber) {
                await tx.user.update({
                    where: { id: userData.user.id },
                    data: { phone: payload.recruiter.contactNumber }
                })
            }

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

    // Authorization: Only ADMIN or SUPER_ADMIN can create admins
    if (!authenticatedUser || (authenticatedUser.role !== Role.ADMIN && authenticatedUser.role !== Role.SUPER_ADMIN)) {
        throw new AppError(
            status.FORBIDDEN,
            "Only admins can create admin accounts"
        );
    }

    // Validate phone format if provided
    if (payload.admin.contactNumber && !BD_PHONE_REGEX.test(payload.admin.contactNumber)) {
        throw new AppError(status.BAD_REQUEST, "Enter a valid 11-digit Bangladeshi phone number starting with 01");
    }

    // Check phone uniqueness if provided
    if (payload.admin.contactNumber) {
        const existingPhone = await prisma.user.findUnique({
            where: { phone: payload.admin.contactNumber },
            select: { id: true }
        });
        if (existingPhone) {
            throw new AppError(status.BAD_REQUEST, "Phone number is already registered");
        }
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
            // Update user with phone number if provided
            if (payload.admin.contactNumber) {
                await tx.user.update({
                    where: { id: userData.user.id },
                    data: { phone: payload.admin.contactNumber }
                })
            }

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
