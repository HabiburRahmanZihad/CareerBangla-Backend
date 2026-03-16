import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ApplicationService } from "./application.service";

const applyJob = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const payload = req.body;
        const result = await ApplicationService.applyJob(user, payload);

        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "Application submitted successfully",
            data: result,
        })
    }
)

const getMyApplications = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await ApplicationService.getMyApplications(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "My applications fetched successfully",
            data: result,
        })
    }
)

const getJobApplications = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { jobId } = req.params;
        const result = await ApplicationService.getJobApplications(user, jobId as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Job applications fetched successfully",
            data: result,
        })
    }
)

const updateApplicationStatus = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { id } = req.params;
        const payload = req.body;
        const result = await ApplicationService.updateApplicationStatus(user, id as string, payload);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Application status updated successfully",
            data: result,
        })
    }
)

const getAllApplications = catchAsync(
    async (req: Request, res: Response) => {
        const result = await ApplicationService.getAllApplications();

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "All applications fetched successfully",
            data: result,
        })
    }
)

export const ApplicationController = {
    applyJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus,
    getAllApplications,
}
