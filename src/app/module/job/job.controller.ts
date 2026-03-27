import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { JobService } from "./job.service";

const createJob = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const payload = req.body;
        const result = await JobService.createJob(user, payload);

        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "Job posted successfully",
            data: result,
        })
    }
)

const getAllJobs = catchAsync(
    async (req: Request, res: Response) => {
        const result = await JobService.getAllJobs(req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Jobs fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

const getJobById = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await JobService.getJobById(id as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Job fetched successfully",
            data: result,
        })
    }
)

const getMyJobs = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await JobService.getMyJobs(user, req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "My jobs fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

const updateJob = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = req.user;
        const payload = req.body;
        const result = await JobService.updateJob(id as string, user, payload);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Job updated successfully",
            data: result,
        })
    }
)

const deleteJob = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { reason } = req.query;
        const user = req.user;
        const result = await JobService.deleteJob(id as string, user, reason as string | undefined);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Job deleted successfully",
            data: result,
        })
    }
)

const createCategory = catchAsync(
    async (req: Request, res: Response) => {
        const { title, name, icon } = req.body as { title?: string; name?: string; icon?: string };
        const normalizedTitle = (title ?? name ?? "").trim();

        if (!normalizedTitle) {
            throw new AppError(status.BAD_REQUEST, "Category title is required");
        }

        const result = await JobService.createCategory(normalizedTitle, icon);

        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "Job category created successfully",
            data: result,
        })
    }
)

const getAllCategories = catchAsync(
    async (req: Request, res: Response) => {
        const result = await JobService.getAllCategories();

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Job categories fetched successfully",
            data: result,
        })
    }
)

const deleteCategory = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await JobService.deleteCategory(id as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Job category deleted successfully",
            data: result,
        })
    }
)

const approveJob = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = req.user;
        const result = await JobService.approveJob(id as string, user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Job approved successfully",
            data: result,
        })
    }
)

const rejectJob = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const { reason } = req.body;
        const user = req.user;
        const result = await JobService.rejectJob(id as string, reason, user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Job rejected successfully",
            data: result,
        })
    }
)

const getPendingJobs = catchAsync(
    async (req: Request, res: Response) => {
        const result = await JobService.getPendingJobs(req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Pending jobs fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

const getPendingJobById = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await JobService.getPendingJobById(id as string);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Pending job details fetched successfully",
            data: result,
        })
    }
)

const getInactiveJobs = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await JobService.getInactiveJobs(user, req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Inactive jobs fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

const deleteInactiveJob = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = req.user;
        const result = await JobService.deleteInactiveJob(id as string, user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Inactive job deleted successfully",
            data: result,
        })
    }
)

export const JobController = {
    createJob,
    getAllJobs,
    getJobById,
    getMyJobs,
    updateJob,
    deleteJob,
    createCategory,
    getAllCategories,
    deleteCategory,
    approveJob,
    rejectJob,
    getPendingJobs,
    getPendingJobById,
    getInactiveJobs,
    deleteInactiveJob,
}
