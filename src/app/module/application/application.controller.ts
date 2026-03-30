import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
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
        const result = await ApplicationService.getMyApplications(user, req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "My applications fetched successfully",
            data: result.data,
            meta: result.meta,
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
        const result = await ApplicationService.getAllApplications(req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "All applications fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

const getApplicantsForJob = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { jobId } = req.params;
        const result = await ApplicationService.getApplicantsForJob(user, jobId as string, req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Job applicants fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

const getUserDirectory = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await ApplicationService.getUserDirectory(user, req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "User directory fetched successfully",
            data: result.data,
            meta: {
                ...result.meta,
                isPremiumRecruiter: result.isPremiumRecruiter,
            },
        })
    }
)

const getHiredCandidates = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user as IRequestUser | undefined;
        const result = await ApplicationService.getHiredCandidates(user, req.query as IQueryParams & { recruiterId?: string; jobId?: string });

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Hired candidates fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

const checkIfApplied = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user as IRequestUser;
        const { jobId } = req.params;
        const result = await ApplicationService.checkIfApplied(user, Array.isArray(jobId) ? jobId[0] : jobId);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Application check successful",
            data: result,
        });
    }
)

export const ApplicationController = {
    applyJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus,
    getAllApplications,
    getApplicantsForJob,
    getUserDirectory,
    getHiredCandidates,
    checkIfApplied,
}
