import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AdminService } from "./admin.service";

const getAllAdmins = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await AdminService.getAllAdmins(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Admins fetched successfully",
            data: result,
        })
    }
)

const getAdminById = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = req.user;

        const admin = await AdminService.getAdminById(id as string, user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Admin fetched successfully",
            data: admin,
        })
    }
)

const updateAdmin = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const payload = req.body;

        const updatedAdmin = await AdminService.updateAdmin(id as string, payload);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Admin updated successfully",
            data: updatedAdmin,
        })
    }
)

const deleteAdmin = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = req.user;

        const result = await AdminService.deleteAdmin(id as string, user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Admin deleted successfully",
            data: result,
        })
    }

)

const changeUserStatus = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const payload = req.body;
        const result = await AdminService.changeUserStatus(user, payload);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User status changed successfully",
            data: result,
        })
    }
);

const changeUserRole = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const payload = req.body;
        const result = await AdminService.changeUserRole(user, payload);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User role changed successfully",
            data: result,
        })
    }
);

const getAllUsers = catchAsync(
    async (req: Request, res: Response) => {
        const result = await AdminService.getAllUsers();
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "All users fetched successfully",
            data: result,
        })
    }
);

const getAllJobs = catchAsync(
    async (req: Request, res: Response) => {
        const result = await AdminService.getAllJobs();
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "All jobs fetched successfully",
            data: result,
        })
    }
);

const getAllUsersWithDetails = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await AdminService.getAllUsersWithDetails(user);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "All users with details fetched successfully",
            data: result,
        })
    }
);

const getAllRecruitersWithDetails = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await AdminService.getAllRecruitersWithDetails(user);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "All recruiters with details fetched successfully",
            data: result,
        })
    }
);

const updateUser = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { userId } = req.params;
        const payload = req.body;

        const result = await AdminService.updateUser(user, userId as string, payload);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User updated successfully",
            data: result,
        })
    }
);

const updateRecruiterData = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { recruiterId } = req.params;
        const payload = req.body;

        const result = await AdminService.updateRecruiterData(user, recruiterId as string, payload);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiter data updated successfully",
            data: result,
        })
    }
);

export const AdminController = {
    getAllAdmins,
    getAllUsers,
    updateAdmin,
    deleteAdmin,
    getAdminById,
    changeUserStatus,
    changeUserRole,
    getAllJobs,
    getAllUsersWithDetails,
    getAllRecruitersWithDetails,
    updateUser,
    updateRecruiterData,
};
