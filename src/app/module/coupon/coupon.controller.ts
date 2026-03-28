import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CouponService } from "./coupon.service";

const createCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await CouponService.createCoupon(req.body);
    sendResponse(res, { httpStatusCode: status.CREATED, success: true, message: "Coupon created successfully", data: result });
});

const getAllCoupons = catchAsync(async (req: Request, res: Response) => {
    const result = await CouponService.getAllCoupons();
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Coupons fetched successfully", data: result });
});

const getCouponById = catchAsync(async (req: Request, res: Response) => {
    const result = await CouponService.getCouponById(req.params.id);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Coupon fetched successfully", data: result });
});

const validateCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await CouponService.validateCoupon(req.user, req.body.code);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Coupon is valid", data: result });
});

const applyCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await CouponService.applyCoupon(req.user, req.body.code);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: result.message, data: result });
});

const deleteCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await CouponService.deleteCoupon(req.params.id);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Coupon deleted successfully", data: result });
});

export const CouponController = {
    createCoupon,
    getAllCoupons,
    getCouponById,
    validateCoupon,
    applyCoupon,
    deleteCoupon,
};
