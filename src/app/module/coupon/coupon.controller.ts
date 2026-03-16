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

const createGiftVoucher = catchAsync(
    async (req: Request, res: Response) => {
        const result = await CouponService.createGiftVoucher(req.body);
        sendResponse(res, {
            httpStatusCode: status.CREATED,
            success: true,
            message: "Gift voucher created successfully",
            data: result,
        })
    }
)

const redeemCoupon = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { code } = req.body;
        const result = await CouponService.redeemCoupon(user, code);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: `Coupon redeemed successfully! ${result.coins} coins added to your wallet.`,
            data: result,
        })
    }
)

const redeemGiftVoucher = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user;
        const { code } = req.body;
        const result = await CouponService.redeemGiftVoucher(user, code);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: `Gift voucher redeemed successfully! ${result.coins} coins added to your wallet.`,
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

const getAllGiftVouchers = catchAsync(
    async (req: Request, res: Response) => {
        const result = await CouponService.getAllGiftVouchers();
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Gift vouchers fetched successfully",
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

const deleteGiftVoucher = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await CouponService.deleteGiftVoucher(id as string);
        sendResponse(res, {
            httpStatusCode: status.OK,
            success: true,
            message: "Gift voucher deleted successfully",
            data: result,
        })
    }
)

export const CouponController = {
    createCoupon,
    createGiftVoucher,
    redeemCoupon,
    redeemGiftVoucher,
    getAllCoupons,
    getAllGiftVouchers,
    deleteCoupon,
    deleteGiftVoucher,
}
