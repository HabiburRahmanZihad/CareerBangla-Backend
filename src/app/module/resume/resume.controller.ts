import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ResumeService } from "./resume.service";

const getMyResume = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await ResumeService.getMyResume(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Resume fetched successfully",
            data: result,
        })
    }
)

const updateMyResume = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const payload = req.body;
        const result = await ResumeService.updateMyResume(user, payload);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Resume updated successfully",
            data: result,
        })
    }
)

const getResumeByUserId = catchAsync(
    async (req: Request, res: Response) => {
        const { userId } = req.params;
        const requestUser = req.user;
        const result = await ResumeService.getResumeByUserId(userId as string, requestUser);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Resume fetched successfully",
            data: result,
        })
    }
)

const getAtsScore = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { jobId } = req.body;
        const result = await ResumeService.getAtsScore(user, jobId);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "ATS score calculated successfully",
            data: result,
        })
    }
)

const searchCandidates = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await ResumeService.searchCandidates(user, req.query);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Candidates fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

export const ResumeController = {
    getMyResume,
    updateMyResume,
    getResumeByUserId,
    getAtsScore,
    searchCandidates,
}
