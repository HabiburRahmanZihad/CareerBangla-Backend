import status from "http-status";
import { CouponStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";

const createCoupon = async (payload: { code: string; discountPercent?: number; discountAmount?: number; maxUsage?: number; expiresAt?: string }) => {
    const existingCoupon = await prisma.coupon.findUnique({
        where: { code: payload.code.toUpperCase() }
    })

    if (existingCoupon) {
        throw new AppError(status.CONFLICT, "Coupon code already exists");
    }

    if (!payload.discountPercent && !payload.discountAmount) {
        throw new AppError(status.BAD_REQUEST, "Either discountPercent or discountAmount must be provided");
    }

    const coupon = await prisma.coupon.create({
        data: {
            code: payload.code.toUpperCase(),
            discountPercent: payload.discountPercent,
            discountAmount: payload.discountAmount,
            maxUsage: payload.maxUsage || 1,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        }
    })

    return coupon;
}

const validateCoupon = async (code: string) => {
    const coupon = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() }
    })

    if (!coupon) {
        throw new AppError(status.NOT_FOUND, "Coupon not found");
    }

    if (coupon.status !== CouponStatus.ACTIVE) {
        throw new AppError(status.BAD_REQUEST, "Coupon is no longer active");
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        // Auto-expire the coupon
        await prisma.coupon.update({
            where: { id: coupon.id },
            data: { status: CouponStatus.EXPIRED }
        })
        throw new AppError(status.BAD_REQUEST, "Coupon has expired");
    }

    if (coupon.usageCount >= coupon.maxUsage) {
        throw new AppError(status.BAD_REQUEST, "Coupon usage limit has been reached");
    }

    return {
        id: coupon.id,
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        discountAmount: coupon.discountAmount,
    };
}

const getAllCoupons = async () => {
    return prisma.coupon.findMany({
        orderBy: { createdAt: "desc" },
    })
}

const deleteCoupon = async (id: string) => {
    await prisma.coupon.delete({ where: { id } })
    return { message: "Coupon deleted successfully" }
}

export const CouponService = {
    createCoupon,
    validateCoupon,
    getAllCoupons,
    deleteCoupon,
}
