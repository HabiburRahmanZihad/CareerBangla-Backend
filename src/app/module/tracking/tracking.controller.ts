import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { TrackingService } from "./tracking.service";

const getReferralTracking = catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await TrackingService.getReferralTracking(page, limit);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Referral tracking data fetched successfully",
        data: result,
    });
});

const getCouponUsageTracking = catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await TrackingService.getCouponUsageTracking(page, limit);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Coupon usage tracking data fetched successfully",
        data: result,
    });
});

export const TrackingController = {
    getReferralTracking,
    getCouponUsageTracking
};
