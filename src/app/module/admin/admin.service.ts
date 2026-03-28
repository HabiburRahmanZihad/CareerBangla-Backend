/* eslint-disable @typescript-eslint/no-explicit-any */
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { cacheManager } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import { logger } from "../../utils/logger";
import { SubscriptionService } from "../subscription/subscription.service";
import { IChangeUserRolePayload, IChangeUserStatusPayload, IUpdateAdminPayload, IUpdateRecruiterDataPayload, IUpdateSubscriptionPlanPayload, IUpdateUserPayload } from "./admin.interface";

const getAllAdmins = async (user: IRequestUser) => {
    logger.read("Fetching all admins");

    // Regular Admins can only see other regular Admins
    // Super Admins can see all Admins (including other Super Admins)
    const isRegularAdmin = user.role === Role.ADMIN;

    // Try to get from cache first (only if it's a Super Admin viewing)
    if (!isRegularAdmin) {
        const cached = cacheManager.admin.getList();
        if (cached) {
            logger.read("✅ Admins list loaded from cache");
            return cached;
        }
    }

    const admins = await prisma.admin.findMany({
        where: isRegularAdmin ? {
            user: {
                role: Role.ADMIN  // Only show regular admins to regular admins
            }
        } : undefined,
        include: {
            user: true,
        },
        orderBy: { createdAt: "desc" }
    })

    // Cache the admins list (only for Super Admin queries)
    if (!isRegularAdmin) {
        cacheManager.admin.setList(admins);
    }

    logger.read(`Admins fetched → count: ${admins.length}, requestorRole: ${user.role}`);
    return admins;
}

const getAllUsers = async () => {
    logger.read("Fetching all users (admin)");
    const users = await prisma.user.findMany({
        where: {
            role: Role.USER,
            isDeleted: false,
        },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            emailVerified: true,
            image: true,
            isPremium: true,
            createdAt: true,
        }
    })
    return users;
}

const getAdminById = async (id: string, user?: IRequestUser) => {
    logger.read(`Fetching admin → id: ${id}`);

    // Try to get from cache first
    const cached = cacheManager.admin.get(id);
    if (cached) {
        logger.read(`✅ Admin loaded from cache → id: ${id}`);
        const cachedData = cached as Record<string, unknown>;
        const cachedUserData = cachedData?.user as Record<string, unknown>;

        // Check access control if user is provided
        if (user && cachedUserData && user.role === Role.ADMIN && cachedUserData?.role === Role.SUPER_ADMIN) {
            throw new AppError(status.FORBIDDEN, "You do not have permission to view this admin account");
        }

        return cached;
    }

    const admin = await prisma.admin.findUnique({
        where: {
            id,
        },
        include: {
            user: true,
        }
    })

    if (!admin) {
        throw new AppError(status.NOT_FOUND, "Admin not found");
    }

    // Check access control: Regular Admins cannot view Super Admin accounts
    if (user && user.role === Role.ADMIN && admin.user.role === Role.SUPER_ADMIN) {
        throw new AppError(status.FORBIDDEN, "You do not have permission to view this admin account");
    }

    // Cache the admin
    if (admin) {
        cacheManager.admin.set(id, admin);
    }

    return admin;
}

const updateAdmin = async (id: string, payload: IUpdateAdminPayload) => {
    logger.update(`Admin update requested → id: ${id}`);
    const isAdminExist = await prisma.admin.findUnique({
        where: {
            id,
        }
    })

    if (!isAdminExist) {
        throw new AppError(status.NOT_FOUND, "Admin Or Super Admin not found");
    }

    const { admin } = payload;

    const updatedAdmin = await prisma.admin.update({
        where: {
            id,
        },
        data: {
            ...admin,
        }
    })
    logger.update(`Admin updated → id: ${id}`);

    // Invalidate cache for this admin
    cacheManager.invalidate.adminUpdated(id, isAdminExist.userId);

    return updatedAdmin;
}

const deleteAdmin = async (id: string, user: IRequestUser) => {
    logger.delete(`Admin delete requested → id: ${id}`);
    const isAdminExist = await prisma.admin.findUnique({
        where: {
            id,
        }
    })

    if (!isAdminExist) {
        throw new AppError(status.NOT_FOUND, "Admin Or Super Admin not found");
    }

    if (isAdminExist.id === user.userId) {
        throw new AppError(status.BAD_REQUEST, "You cannot delete yourself");
    }

    const result = await prisma.$transaction(async (tx) => {
        await tx.admin.update({
            where: { id },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
            },
        })

        await tx.user.update({
            where: { id: isAdminExist.userId },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
                status: UserStatus.DELETED
            },
        })

        await tx.session.deleteMany({
            where: { userId: isAdminExist.userId }
        })

        await tx.account.deleteMany({
            where: { userId: isAdminExist.userId }
        })

        const admin = await getAdminById(id);

        return admin;
    }
    )
    logger.delete(`Admin deleted → id: ${id}`);

    // Invalidate cache for this admin
    cacheManager.invalidate.adminUpdated(id, isAdminExist.userId);

    return result;
}

const changeUserStatus = async (user: IRequestUser, payload: IChangeUserStatusPayload) => {
    const isAdminExists = await prisma.admin.findUniqueOrThrow({
        where: {
            email: user.email
        },
        include: {
            user: true,
        }
    });

    const { userId, userStatus } = payload;
    logger.update(`User status change → userId: ${userId}, newStatus: ${userStatus}`);

    const userToChangeStatus = await prisma.user.findUniqueOrThrow({
        where: {
            id: userId,
        }
    })

    const selfStatusChange = isAdminExists.userId === userId;

    if (selfStatusChange) {
        throw new AppError(status.BAD_REQUEST, "You cannot change your own status");
    };

    if (isAdminExists.user.role === Role.ADMIN && userToChangeStatus.role === Role.SUPER_ADMIN) {
        throw new AppError(status.BAD_REQUEST, "You cannot change the status of super admin. Only super admin can change the status of another super admin");
    }

    if (isAdminExists.user.role === Role.ADMIN && userToChangeStatus.role === Role.ADMIN) {
        throw new AppError(status.BAD_REQUEST, "You cannot change the status of another admin. Only super admin can change the status of another admin");
    }

    if (userStatus === UserStatus.DELETED) {
        throw new AppError(status.BAD_REQUEST, "You cannot set user status to deleted. Use the role-specific delete API instead.");
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        }, data: {
            status: userStatus,
        }
    })
    logger.update(`User status changed → userId: ${userId}, status: ${userStatus}`);

    // Create notification for the user
    const statusMessage = userStatus === UserStatus.BLOCKED
        ? "Your account has been blocked by an administrator. Please contact support for more information."
        : "Your account has been reactivated. You can now access all features.";

    await prisma.notification.create({
        data: {
            userId,
            type: "GENERAL",
            title: userStatus === UserStatus.BLOCKED ? "Account Blocked" : "Account Reactivated",
            message: statusMessage,
        }
    });

    // Send email notification
    try {
        await sendEmail({
            to: userToChangeStatus.email,
            subject: `CareerBangla - Account ${userStatus === UserStatus.BLOCKED ? "Blocked" : "Reactivated"}`,
            templateName: "applicationStatus",
            templateData: {
                name: userToChangeStatus.name,
                jobTitle: "Account Status",
                companyName: "CareerBangla",
                status: userStatus === UserStatus.BLOCKED ? "blocked" : "reactivated",
                message: statusMessage,
            }
        });
    } catch {
        /* email delivery is best-effort */
    }

    return updatedUser;
}

const changeUserRole = async (user: IRequestUser, payload: IChangeUserRolePayload) => {
    const isSuperAdminExists = await prisma.admin.findFirstOrThrow({
        where: {
            email: user.email,
            user: {
                role: Role.SUPER_ADMIN
            }
        },
        include: {
            user: true,
        }
    });

    const { userId, role } = payload;
    logger.update(`User role change → userId: ${userId}, newRole: ${role}`);

    const userToChangeRole = await prisma.user.findUniqueOrThrow({
        where: {
            id: userId,
        }
    })

    const selfRoleChange = isSuperAdminExists.userId === userId;

    if (selfRoleChange) {
        throw new AppError(status.BAD_REQUEST, "You cannot change your own role");
    }

    if (userToChangeRole.role === Role.RECRUITER || userToChangeRole.role === Role.USER) {
        throw new AppError(status.BAD_REQUEST, "You cannot change the role of recruiter or user. If you want to change the role, you have to delete the user and recreate with new role");
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            role,
        }
    })
    logger.update(`User role changed → userId: ${userId}, role: ${role}`);

    return updatedUser;

}

// Admin-specific: manage all jobs
const getAllJobs = async (query: IQueryParams) => {
    logger.read("Fetching all jobs (admin)", { filters: query });

    await prisma.job.updateMany({
        where: {
            status: "LIVE",
            deadline: { lt: new Date() },
            isDeleted: false,
        },
        data: { status: "INACTIVE" },
    });

    const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
    const parsedLimit = Number.parseInt(query.limit || "20", 10) || 20;
    const limit = Math.min(100, Math.max(1, parsedLimit));
    const skip = (page - 1) * limit;

    const searchTerm = query.searchTerm?.trim();
    const statusFilter = query.status?.trim();
    const jobTypeFilter = query.jobType?.trim();

    const andConditions: Prisma.JobWhereInput[] = [];

    if (searchTerm) {
        andConditions.push({
            OR: [
                { title: { contains: searchTerm, mode: "insensitive" } },
                { description: { contains: searchTerm, mode: "insensitive" } },
                { recruiter: { companyName: { contains: searchTerm, mode: "insensitive" } } },
                { location: { contains: searchTerm, mode: "insensitive" } },
            ],
        });
    }

    if (statusFilter && statusFilter !== "ALL") {
        andConditions.push({ status: statusFilter as any });
    }

    if (jobTypeFilter && jobTypeFilter !== "ALL") {
        andConditions.push({ jobType: jobTypeFilter as any });
    }

    const where: Prisma.JobWhereInput = {
        isDeleted: false,
        ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const [jobs, total] = await Promise.all([
        prisma.job.findMany({
            where,
            include: {
                recruiter: {
                    select: { id: true, name: true, email: true, companyName: true },
                },
                category: true,
                _count: {
                    select: { applications: true },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.job.count({ where }),
    ]);

    return {
        data: jobs,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    };
}

// Get all users with complete details - with access control
const getAllUsersWithDetails = async (user: IRequestUser) => {
    logger.read("Fetching all users with details (admin)");

    await prisma.admin.findUniqueOrThrow({
        where: { email: user.email },
        include: { user: true }
    });

    // Users Management page is strictly for regular users only.
    const whereClause: Record<string, unknown> = {
        isDeleted: false,
        role: Role.USER,
    };

    const users = await prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        include: {
            resume: true,
            applications: {
                where: { status: "HIRED" },
                select: { id: true }
            }
        }
    });

    // Map to include computed isHired field
    const usersWithHiredStatus = users.map((user: any) => ({
        ...user,
        isHired: user.applications && user.applications.length > 0,
        applications: undefined // Remove applications array from response
    }));

    return usersWithHiredStatus;
}

// Get all recruiters with complete details - with access control
const getAllRecruitersWithDetails = async (user: IRequestUser) => {
    logger.read("Fetching all recruiters with details (admin)");

    // Validate user exists (will throw if not found)
    await prisma.admin.findUniqueOrThrow({
        where: { email: user.email }
    });

    const recruiters = await prisma.recruiter.findMany({
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        include: {
            user: true,
            jobs: {
                where: { isDeleted: false },
                select: { id: true, title: true }
            }
        }
    });

    // If not Super Admin, filter out their access if needed
    return recruiters;
}

// Update user data - Admin/Super Admin only
const updateUser = async (user: IRequestUser, userId: string, payload: IUpdateUserPayload) => {
    logger.update(`User update requested → userId: ${userId}`);

    const admin = await prisma.admin.findUniqueOrThrow({
        where: { email: user.email },
        include: { user: true }
    });

    const userToUpdate = await prisma.user.findUniqueOrThrow({
        where: { id: userId }
    });

    // Admin cannot update Admin or Super Admin accounts
    if (admin.user.role === Role.ADMIN &&
        (userToUpdate.role === Role.ADMIN || userToUpdate.role === Role.SUPER_ADMIN)) {
        throw new AppError(status.FORBIDDEN, "You do not have permission to update this user");
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            ...(payload.name && { name: payload.name }),
            ...(payload.email && { email: payload.email }),
            ...(payload.image && { image: payload.image }),
            ...(payload.phone && { phone: payload.phone }),
            ...(payload.country && { country: payload.country }),
            ...(payload.isPremium !== undefined && { isPremium: payload.isPremium }),
            ...(payload.premiumUntil && { premiumUntil: new Date(payload.premiumUntil) }),
        },
        include: {
            resume: true,
            recruiter: true,
            admin: true,
            applications: {
                where: { status: "HIRED" },
                select: { id: true }
            }
        }
    });

    logger.update(`User updated → userId: ${userId}`);
    return {
        ...updatedUser,
        isHired: updatedUser.applications && updatedUser.applications.length > 0,
        applications: undefined
    };
}

// Update recruiter data - Admin/Super Admin only
const updateRecruiterData = async (user: IRequestUser, recruiterId: string, payload: IUpdateRecruiterDataPayload) => {
    logger.update(`Recruiter data update requested → recruiterId: ${recruiterId}`);

    // Validate user exists (will throw if not found)
    await prisma.admin.findUniqueOrThrow({
        where: { email: user.email }
    });

    // Validate recruiter exists (will throw if not found)
    await prisma.recruiter.findUniqueOrThrow({
        where: { id: recruiterId }
    });

    const updatedRecruiter = await prisma.recruiter.update({
        where: { id: recruiterId },
        data: {
            ...(payload.name && { name: payload.name }),
            ...(payload.email && { email: payload.email }),
            ...(payload.profilePhoto && { profilePhoto: payload.profilePhoto }),
            ...(payload.contactNumber && { contactNumber: payload.contactNumber }),
            ...(payload.companyName && { companyName: payload.companyName }),
            ...(payload.companyLogo && { companyLogo: payload.companyLogo }),
            ...(payload.companyWebsite && { companyWebsite: payload.companyWebsite }),
            ...(payload.companyAddress && { companyAddress: payload.companyAddress }),
            ...(payload.designation && { designation: payload.designation }),
            ...(payload.industry && { industry: payload.industry }),
            ...(payload.companySize && { companySize: payload.companySize }),
            ...(payload.description && { description: payload.description }),
        },
        include: {
            user: true,
            jobs: true,
        }
    });

    logger.update(`Recruiter data updated → recruiterId: ${recruiterId}`);
    return updatedRecruiter;
}

// Delete user completely from database
const deleteUser = async (user: IRequestUser, userId: string) => {
    logger.delete(`User deletion requested → userId: ${userId}`);

    const admin = await prisma.admin.findUniqueOrThrow({
        where: { email: user.email },
        include: { user: true }
    });

    const userToDelete = await prisma.user.findUniqueOrThrow({
        where: { id: userId }
    });

    // Admin cannot delete Admin or Super Admin accounts
    if (admin.user.role === Role.ADMIN &&
        (userToDelete.role === Role.ADMIN || userToDelete.role === Role.SUPER_ADMIN)) {
        throw new AppError(status.FORBIDDEN, "You do not have permission to delete this user");
    }

    const result = await prisma.$transaction(async (tx) => {
        // Delete related data
        await tx.application.deleteMany({ where: { userId } });
        await tx.session.deleteMany({ where: { userId } });
        await tx.account.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.resume.deleteMany({ where: { userId } });

        // Delete recruiter or admin if exists
        if (userToDelete.role === Role.RECRUITER) {
            await tx.recruiter.delete({ where: { userId } });
        } else if (userToDelete.role === Role.ADMIN || userToDelete.role === Role.SUPER_ADMIN) {
            await tx.admin.delete({ where: { userId } });
        }

        // Delete user
        const deletedUser = await tx.user.delete({
            where: { id: userId }
        });

        return deletedUser;
    });

    logger.delete(`User deleted → userId: ${userId}`);
    return result;
}

// Admin-specific: update job details
const updateJob = async (jobId: string, payload: Record<string, any>) => {
    logger.update(`Job update requested by admin → jobId: ${jobId}`);

    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { recruiter: { select: { user: { select: { email: true } } } } }
    });

    if (!job) {
        throw new AppError(status.NOT_FOUND, "Job not found");
    }

    // Prevent updates to inactive or closed jobs
    if (job.status === "INACTIVE" || job.status === "CLOSED") {
        throw new AppError(status.FORBIDDEN, `Cannot update a ${job.status.toLowerCase()} job. You can only delete it.`);
    }

    const updateData: any = {};

    // Whitelist of fields that can be updated
    const allowedFields = [
        "title",
        "description",
        "requirements",
        "responsibilities",
        "benefits",
        "location",
        "locationType",
        "jobType",
        "experienceLevel",
        "salaryMin",
        "salaryMax",
        "experience",
        "education",
        "skills",
        "vacancies",
        "applicationDeadline",
        "categoryId",
    ];

    allowedFields.forEach((field) => {
        if (payload[field] !== undefined) {
            updateData[field] = payload[field];
        }
    });

    // Handle date fields
    if (payload.applicationDeadline) {
        updateData.applicationDeadline = new Date(payload.applicationDeadline);
    }

    const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: updateData,
        include: { recruiter: true, category: true },
    });

    logger.update(`Job updated by admin → jobId: ${jobId}`);
    return updatedJob;
}

const updateUserHiredStatus = async (user: IRequestUser, userId: string, isHired: boolean) => {
    logger.update(`User hired status update → userId: ${userId}, isHired: ${isHired}`);

    await prisma.admin.findUniqueOrThrow({
        where: { email: user.email },
        include: { user: true }
    });

    await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (isHired) {
        const latestApp = await prisma.application.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" }
        });

        if (!latestApp) {
            throw new AppError(status.BAD_REQUEST, "User has no applications. Cannot mark as hired.");
        }

        await prisma.application.update({
            where: { id: latestApp.id },
            data: { status: "HIRED", hiredDate: new Date() }
        });
    } else {
        await prisma.application.updateMany({
            where: { userId, status: "HIRED" },
            data: { status: "PENDING", hiredDate: null }
        });
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
            applications: {
                where: { status: "HIRED" },
                select: { id: true }
            }
        }
    });

    logger.update(`User hired status updated → userId: ${userId}`);
    return {
        ...updatedUser,
        isHired: updatedUser.applications.length > 0,
        applications: undefined
    };
}

const updateSubscriptionPlan = async (planKey: string, payload: IUpdateSubscriptionPlanPayload) => {
    logger.update(`Admin subscription plan update requested → planKey: ${planKey}`);
    return SubscriptionService.updateSubscriptionPlanConfig(planKey, payload);
}

export const AdminService = {
    getAllAdmins,
    getAllUsers,
    getAdminById,
    updateAdmin,
    deleteAdmin,
    changeUserStatus,
    changeUserRole,
    getAllJobs,
    getAllUsersWithDetails,
    getAllRecruitersWithDetails,
    updateUser,
    updateUserHiredStatus,
    updateRecruiterData,
    deleteUser,
    updateJob,
    updateSubscriptionPlan,
}
