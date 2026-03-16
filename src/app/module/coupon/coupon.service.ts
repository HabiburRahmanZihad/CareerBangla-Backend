import status from "http-status";
import { CouponStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";

const createCoupon = async (payload: { code: string; coins: number; expiresAt?: string }) => {
    const existingCoupon = await prisma.coupon.findUnique({
        where: { code: payload.code }
    })

    if (existingCoupon) {
        throw new AppError(status.CONFLICT, "Coupon code already exists");
    }

    const coupon = await prisma.coupon.create({
        data: {
            code: payload.code.toUpperCase(),
            coins: payload.coins,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        }
    })

    return coupon;
}

const createGiftVoucher = async (payload: { code: string; coins: number; recipientEmail?: string; expiresAt?: string }) => {
    const existingVoucher = await prisma.giftVoucher.findUnique({
        where: { code: payload.code }
    })

    if (existingVoucher) {
        throw new AppError(status.CONFLICT, "Gift voucher code already exists");
    }

    const voucher = await prisma.giftVoucher.create({
        data: {
            code: payload.code.toUpperCase(),
            coins: payload.coins,
            recipientEmail: payload.recipientEmail,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        }
    })

    return voucher;
}

const redeemCoupon = async (user: IRequestUser, code: string) => {
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
        throw new AppError(status.BAD_REQUEST, "Coupon has expired");
    }

    const result = await prisma.$transaction(async (tx) => {
        // Mark coupon as used
        await tx.coupon.update({
            where: { id: coupon.id },
            data: {
                status: CouponStatus.USED,
                usedBy: user.userId,
                usedAt: new Date(),
            }
        })

        // Credit coins to wallet
        const wallet = await tx.wallet.findUnique({
            where: { userId: user.userId }
        })

        if (wallet) {
            await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: coupon.coins } }
            })

            await tx.coinTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount: coupon.coins,
                    type: "CREDIT",
                    purpose: "COUPON_REDEEM",
                    details: `Redeemed coupon: ${coupon.code}`,
                }
            })
        } else {
            await tx.wallet.create({
                data: {
                    userId: user.userId,
                    balance: coupon.coins,
                    transactions: {
                        create: {
                            amount: coupon.coins,
                            type: "CREDIT",
                            purpose: "COUPON_REDEEM",
                            details: `Redeemed coupon: ${coupon.code}`,
                        }
                    }
                }
            })
        }

        return { coins: coupon.coins, code: coupon.code };
    })

    return result;
}

const redeemGiftVoucher = async (user: IRequestUser, code: string) => {
    const voucher = await prisma.giftVoucher.findUnique({
        where: { code: code.toUpperCase() }
    })

    if (!voucher) {
        throw new AppError(status.NOT_FOUND, "Gift voucher not found");
    }

    if (voucher.status !== CouponStatus.ACTIVE) {
        throw new AppError(status.BAD_REQUEST, "Gift voucher is no longer active");
    }

    if (voucher.expiresAt && new Date(voucher.expiresAt) < new Date()) {
        throw new AppError(status.BAD_REQUEST, "Gift voucher has expired");
    }

    if (voucher.recipientEmail && voucher.recipientEmail !== user.email) {
        throw new AppError(status.FORBIDDEN, "This gift voucher is not for you");
    }

    const result = await prisma.$transaction(async (tx) => {
        await tx.giftVoucher.update({
            where: { id: voucher.id },
            data: {
                status: CouponStatus.USED,
                usedBy: user.userId,
                usedAt: new Date(),
            }
        })

        const wallet = await tx.wallet.findUnique({
            where: { userId: user.userId }
        })

        if (wallet) {
            await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: voucher.coins } }
            })

            await tx.coinTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount: voucher.coins,
                    type: "CREDIT",
                    purpose: "GIFT_VOUCHER_REDEEM",
                    details: `Redeemed gift voucher: ${voucher.code}`,
                }
            })
        } else {
            await tx.wallet.create({
                data: {
                    userId: user.userId,
                    balance: voucher.coins,
                    transactions: {
                        create: {
                            amount: voucher.coins,
                            type: "CREDIT",
                            purpose: "GIFT_VOUCHER_REDEEM",
                            details: `Redeemed gift voucher: ${voucher.code}`,
                        }
                    }
                }
            })
        }

        return { coins: voucher.coins, code: voucher.code };
    })

    return result;
}

const getAllCoupons = async () => {
    return prisma.coupon.findMany({
        orderBy: { createdAt: "desc" },
    })
}

const getAllGiftVouchers = async () => {
    return prisma.giftVoucher.findMany({
        orderBy: { createdAt: "desc" },
    })
}

const deleteCoupon = async (id: string) => {
    await prisma.coupon.delete({ where: { id } })
    return { message: "Coupon deleted successfully" }
}

const deleteGiftVoucher = async (id: string) => {
    await prisma.giftVoucher.delete({ where: { id } })
    return { message: "Gift voucher deleted successfully" }
}

export const CouponService = {
    createCoupon,
    createGiftVoucher,
    redeemCoupon,
    redeemGiftVoucher,
    getAllCoupons,
    getAllGiftVouchers,
    deleteCoupon,
    deleteGiftVoucher,
}
