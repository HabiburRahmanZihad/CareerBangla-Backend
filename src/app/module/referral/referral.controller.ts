import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ReferralService } from "./referral.service";

const getMyReferralStats = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const result = await ReferralService.getMyReferralStats(user);

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Referral stats fetched successfully",
            data: result,
        });
    }
);

const searchReferrals = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { search } = req.query;
        const result = await ReferralService.searchReferrals(user, (search as string) || "");

        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Referrals search results fetched successfully",
            data: result,
        });
    }
);

export const ReferralController = {
    getMyReferralStats,
    searchReferrals,
};
