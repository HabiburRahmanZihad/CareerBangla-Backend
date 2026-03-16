import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { RecruiterService } from "./recruiter.service";

const getAllRecruiters = catchAsync(
    async (req: Request, res: Response) => {
        const result = await RecruiterService.getAllRecruiters(req.query);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiters fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

const getRecruiterById = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await RecruiterService.getRecruiterById(id as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiter fetched successfully",
            data: result,
        })
    }
)

const getMyProfile = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await RecruiterService.getMyProfile(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiter profile fetched successfully",
            data: result,
        })
    }
)

const updateRecruiter = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const payload = req.body;
        const result = await RecruiterService.updateRecruiter(id as string, payload);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiter updated successfully",
            data: result,
        })
    }
)

const updateMyProfile = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const payload = req.body;
        const result = await RecruiterService.updateMyProfile(user, payload);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiter profile updated successfully",
            data: result,
        })
    }
)

const deleteRecruiter = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await RecruiterService.deleteRecruiter(id as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiter deleted successfully",
            data: result,
        })
    }
)

const approveRecruiter = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await RecruiterService.approveRecruiter(id as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiter approved successfully",
            data: result,
        })
    }
)

const rejectRecruiter = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await RecruiterService.rejectRecruiter(id as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiter rejected successfully",
            data: result,
        })
    }
)

const viewRecruiterEmail = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { recruiterId } = req.params;
        const result = await RecruiterService.viewRecruiterEmail(user, recruiterId as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Recruiter email fetched successfully",
            data: result,
        })
    }
)

export const RecruiterController = {
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
