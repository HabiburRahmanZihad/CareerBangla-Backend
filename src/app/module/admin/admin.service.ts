import status from "http-status";
import { Role, UserStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { IChangeUserRolePayload, IChangeUserStatusPayload, IUpdateAdminPayload } from "./admin.interface";
import { logger } from "../../utils/logger";

const getAllAdmins = async () => {
    logger.read("Fetching all admins");
    const admins = await prisma.admin.findMany({
        include: {
            user: true,
        }
    })
    return admins;
}

const getAdminById = async (id: string) => {
    logger.read(`Fetching admin → id: ${id}`);
    const admin = await prisma.admin.findUnique({
        where: {
            id,
        },
        include: {
            user: true,
        }
    })
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
const getAllJobs = async () => {
    logger.read("Fetching all jobs (admin)");
    const jobs = await prisma.job.findMany({
        include: {
            recruiter: {
                select: { id: true, name: true, companyName: true }
            },
            category: true,
            _count: {
                select: { applications: true }
            }
        },
        orderBy: { createdAt: "desc" },
    })
    return jobs;
}

export const AdminService = {
    getAllAdmins,
    getAdminById,
    updateAdmin,
    deleteAdmin,
    changeUserStatus,
    changeUserRole,
    getAllJobs,
}
