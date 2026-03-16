import { Request, Response } from "express";
import status from "http-status";
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
        const result = await JobService.getAllJobs(req.query);

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
        const result = await JobService.getMyJobs(user, req.query);

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
        const user = req.user;
        const result = await JobService.deleteJob(id as string, user);

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
        const { title, icon } = req.body;
        const result = await JobService.createCategory(title, icon);

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
}
