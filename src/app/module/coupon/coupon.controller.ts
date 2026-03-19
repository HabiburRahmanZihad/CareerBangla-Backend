import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CouponService } from "./coupon.service";

const createCoupon = catchAsync(
    async (req: Request, res: Response) => {
        const result = await CouponService.createCoupon(req.body);
        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "Coupon created successfully",
            data: result,
        })
    }
)

const validateCoupon = catchAsync(
    async (req: Request, res: Response) => {
        const { code } = req.body;
        const result = await CouponService.validateCoupon(code);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Coupon is valid",
            data: result,
        })
    }
)

const getAllCoupons = catchAsync(
    async (req: Request, res: Response) => {
        const result = await CouponService.getAllCoupons();
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Coupons fetched successfully",
            data: result,
        })
    }
)

const deleteCoupon = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await CouponService.deleteCoupon(id as string);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Coupon deleted successfully",
            data: result,
        })
    }
)

export const CouponController = {
    createCoupon,
    validateCoupon,
    getAllCoupons,
    deleteCoupon,
}
