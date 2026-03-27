import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
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
        const result = await ResumeService.searchCandidates(user, req.query as IQueryParams);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Candidates fetched successfully",
            data: result.data,
            meta: result.meta,
        })
    }
)

const deleteMyResume = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        await ResumeService.deleteMyResume(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Resume deleted successfully",
            data: null,
        })
    }
)

const downloadResumePdf = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const targetUserId = req.query.userId as string | undefined;
        const pdfBuffer = await ResumeService.downloadResumePdf(user, targetUserId);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="CareerBangla-Resume.pdf"`,
            "Content-Length": pdfBuffer.length,
        });
        res.send(pdfBuffer);
    }
)

const uploadProfilePhoto = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const file = req.file;

        if (!file) {
            return sendResponse(res, {
                httpStatusCode: status.BAD_REQUEST,
                success: false,
                message: "No file uploaded",
                data: null,
            });
        }

        const result = await ResumeService.uploadProfilePhoto(user, file.buffer, file.originalname);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Profile photo uploaded successfully",
            data: result,
        });
    }
)

const downloadCvForRecruiter = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { candidateId, applicationId } = req.query;
        const pdfBuffer = await ResumeService.downloadCvForRecruiter(user, candidateId as string, applicationId as string | undefined);

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="Candidate-CV.pdf"`,
            "Content-Length": pdfBuffer.length,
        });
        res.send(pdfBuffer);
    }
)

export const ResumeController = {
    getMyResume,
    updateMyResume,
    getResumeByUserId,
    getAtsScore,
    searchCandidates,
    deleteMyResume,
    downloadResumePdf,
    uploadProfilePhoto,
    downloadCvForRecruiter,
}
