import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { UserService } from "./user.service";

const createRecruiter = catchAsync(
    async (req: Request, res: Response) => {
        const payload = req.body;
        const result = await UserService.createRecruiter(payload);

        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "Recruiter registered successfully. Awaiting admin approval.",
            data: result,
        })
    }
)

const createAdmin = catchAsync(
    async (req: Request, res: Response) => {
        const payload = req.body;
        const authenticatedUser = req.user;

        const result = await UserService.createAdmin(payload, authenticatedUser);

        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "Admin registered successfully",
            data: result,
        })
    }
)

export const UserController = {
    createRecruiter,
    createAdmin,
};
